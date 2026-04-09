# Building an Open-Source Profiler for iOS: A Perfetto-Inspired Approach

On-device AI is one of the biggest shifts in mobile computing. Apple Silicon now runs billion-parameter models on your phone, Core ML pipelines compete for GPU time with your rendering code, and developers are shipping features that would have been server-side two years ago. But when something goes wrong -- when your inference takes 200ms instead of 30, or your UI hitches during a model load -- what do you reach for? Apple Instruments is powerful, but it is closed-source, tied to Xcode, and impossible to extend. There is nothing like Google's Perfetto for iOS. So I built one.

## The Gap

If you profile Android apps, you have Perfetto: open-source, web-based, extensible, and used by Google internally. It captures system-wide traces, renders them in a browser, and lets anyone build tooling on top.

iOS has nothing equivalent. Apple Instruments is excellent at what it does, but it runs only inside Xcode, on a Mac, with no scriptable API and no way to view traces in a browser or CI pipeline. The closest open-source alternatives either solve a different problem or cover only a slice of the picture:

- **ETTrace** profiles only the main thread via signal-based sampling
- **Sentry/Datadog** are production APM tools -- they aggregate, they don't give you a frame-level timeline
- **MetricKit** provides coarse 24-hour aggregates, not real-time traces

I wanted the full picture: CPU call stacks across all threads, memory footprint over time, UI hitch detection with stack traces, GPU command buffer timing, and signpost regions -- all streaming into a web-based timeline I could zoom and pan through.

## Architecture

InstrumentsOS has three layers, each chosen for a specific reason:

```
 iOS App (on device)           Mac / Server              Browser
 ┌──────────────────┐         ┌──────────────┐         ┌─────────────┐
 │   InstrumentsOS  │  WS     │   Python     │  REST   │  React +    │
 │   SDK            │────────>│   Backend    │────────>│  Canvas     │
 │   (C/ObjC/Swift) │         │              │         │  Viewer     │
 │                  │         │  - WebSocket │         │             │
 │  - CPU Sampler   │         │  - atos sym  │         │  - Timeline │
 │  - Memory Track  │         │  - SQLite    │         │  - Zoom/Pan │
 │  - Hitch Detect  │         │  - REST API  │         │  - Details  │
 │  - GPU Tracker   │         │              │         │             │
 │  - Ring Buffer   │         └──────────────┘         └─────────────┘
 │  - WS Transport  │
 └──────────────────┘
```

**The SDK is C and Objective-C** because profiling code must not allocate, must not lock, and must be as close to the metal as possible. Swift's runtime overhead (retain/release traffic, potential allocations in closures) is unacceptable in a sampling interrupt. The public API is a thin Swift `enum` facade, but every hot path is C.

**The backend is Python** because it is a glue layer. It receives JSON events over WebSocket, calls `atos` for symbolication, stores everything in SQLite with WAL mode, and serves a REST API. Performance here is irrelevant -- the bottleneck is the network, not the server.

**The viewer is React with a Canvas renderer** because DOM-based rendering cannot handle tens of thousands of trace events at 60fps. The Canvas renderer bins CPU samples into pixel columns, draws area charts and bar charts directly, and re-renders on every zoom/pan gesture. React handles the toolbar and detail panels; Canvas handles the timeline.

## The Hard Part: CPU Sampling

The core of any profiler is capturing where threads are spending time. Here is how InstrumentsOS does it -- and it is the same fundamental technique that Sentry, PLCrashReporter, and Apple's own `sample` tool use.

The sampler runs on a dedicated high-priority thread (SCHED_FIFO, priority 47 -- the same range CoreAudio uses). Every 10ms (configurable), it does this:

**1. Enumerate all threads in the process:**

```c
thread_act_array_t threads = NULL;
mach_msg_type_number_t thread_count = 0;
kern_return_t kr = task_threads(mach_task_self(), &threads, &thread_count);
```

`task_threads()` is a Mach kernel trap that returns every thread in the current task. It allocates memory via the kernel's VM system -- we deallocate it after each sample.

**2. Suspend each thread and read its registers:**

```c
kern_return_t kr = thread_suspend(thread);

arm_thread_state64_t state;
mach_msg_type_number_t count = ARM_THREAD_STATE64_COUNT;
kr = thread_get_state(thread, ARM_THREAD_STATE64,
                      (thread_state_t)&state, &count);

uint64_t fp = arm_thread_state64_get_fp(state);
uint64_t pc = arm_thread_state64_get_pc(state);

thread_resume(thread);  // Always resume, regardless of errors above
```

This is the critical moment. We freeze the target thread via `thread_suspend()`, read its ARM64 register file to get the frame pointer (FP/x29) and program counter (PC), then immediately resume it. The thread is suspended for microseconds.

**3. Walk the frame-pointer chain:**

```c
while (fp > 0x1000 && count < max_depth) {
    uint64_t frame_data[2] = {0, 0};
    vm_size_t bytes_read = 0;
    kern_return_t kr = vm_read_overwrite(
        mach_task_self(), (vm_address_t)fp,
        sizeof(frame_data), (vm_address_t)frame_data, &bytes_read);
    if (kr != KERN_SUCCESS) break;

    uint64_t saved_fp = frame_data[0];
    uint64_t ret_addr = frame_data[1];

    frames[count++] = ret_addr;
    if (saved_fp <= fp) break;  // Detect corruption
    fp = saved_fp;
}
```

On ARM64, each stack frame stores two values at the frame pointer: the caller's frame pointer and the return address. We walk this chain using `vm_read_overwrite` (which fails gracefully on unmapped memory instead of crashing) until we hit the bottom of the stack, an invalid pointer, or our maximum depth of 128 frames.

**Safety is paramount.** A profiler that crashes the app is worse than no profiler. Three things keep this safe:

- `thread_resume()` is called unconditionally, even if `thread_get_state()` fails
- `vm_read_overwrite` is used instead of raw pointer dereference, so unmapped memory returns an error instead of a SIGSEGV
- The sampler skips its own thread (`mach_thread_self()` check) to avoid self-deadlock

All captured samples go into a lock-free SPSC ring buffer:

```c
struct ios_ring_buffer {
    ios_event_t  *buffer;
    uint32_t      mask;          // capacity - 1 (power of 2)
    _Atomic uint32_t write_head;
    _Atomic uint32_t read_head;
};
```

The ring buffer uses atomic loads and stores with acquire/release memory ordering -- no mutexes, no system calls, no allocation on the hot path. If the consumer falls behind, samples are dropped rather than blocking the sampler thread. This is a deliberate tradeoff: we never want the profiler to affect the timing of the code being profiled.

## GPU Profiling in the AI Age

With Core ML running transformer models on the Apple Neural Engine and GPU, and with Metal compute shaders becoming the backbone of on-device inference, GPU profiling has gone from "nice to have" to essential. A Core ML model that falls back from the ANE to the GPU can blow your frame budget and cause visible hitches.

InstrumentsOS tracks GPU activity using only public Metal APIs -- no private frameworks, no entitlements:

```objc
[cmdBuf addCompletedHandler:^(id<MTLCommandBuffer> buf) {
    event.gpu_cmd_buf.gpu_start_ns = (uint64_t)(buf.GPUStartTime * 1e9);
    event.gpu_cmd_buf.gpu_end_ns   = (uint64_t)(buf.GPUEndTime * 1e9);
    event.gpu_cmd_buf.gpu_duration_ms = (buf.GPUEndTime - buf.GPUStartTime) * 1000.0;
    ios_ring_buffer_write(rb, &event);
}];
```

`MTLCommandBuffer.GPUStartTime` and `GPUEndTime` give you the actual GPU-side execution times, not the CPU-side submission times. This is the same data that Metal System Trace shows, but captured programmatically.

For GPU memory, we sample `MTLDevice.currentAllocatedSize` on a dedicated thread:

```objc
event.gpu_memory.allocated_bytes = (uint64_t)_device.currentAllocatedSize;
```

This tracks how much VRAM your app is consuming, which matters enormously when Core ML models and render targets are competing for the same memory pool.

## The Web Viewer

I chose a web-based viewer over a native Mac app for three reasons: it runs anywhere, it can be embedded in CI dashboards, and Canvas rendering is fast enough.

The timeline is a custom Canvas renderer -- no charting library. Each track type (CPU, Memory, Hitches, GPU, Signposts) has its own rendering function that bins events into pixel columns and draws directly:

```typescript
// CPU track: bin samples into pixel columns, draw area chart
const binCount = Math.floor(trackAreaWidth);
const bins = new Float64Array(binCount);

for (const evt of cpuEvents) {
    const bin = Math.floor(
        ((evt.timestamp_ns - visibleStart) / visibleRange) * binCount
    );
    if (bin >= 0 && bin < binCount) bins[bin]++;
}
```

This means zooming in from a 10-second view to a 5ms view works smoothly -- we re-bin on every frame. The `TimelineState` class handles zoom (scroll wheel) and pan (click-drag), clamping to data bounds and enforcing a 1ms minimum visible range.

Hitch events are color-coded by severity -- green for minor hitches, yellow for noticeable delays, red for severe hangs. Signpost regions are rendered as labeled bars with automatic lane assignment to avoid overlapping.

The viewer connects to the backend via both REST (for loading saved sessions) and WebSocket (for live streaming). When you are profiling an app, events appear in the timeline in real-time.

## What I Learned

**Mach APIs are powerful and poorly documented.** The XNU kernel exposes `thread_suspend`, `thread_get_state`, `task_threads`, `vm_read_overwrite`, and `task_info` -- all the primitives you need to build a profiler. But the documentation is scattered across decades-old Mach headers, Apple's kernel source dumps, and reverse-engineering blog posts. I spent more time reading `<mach/thread_act.h>` than writing code.

**The observer effect is real.** A profiler that allocates memory while sampling memory usage gives you bad data. A profiler that takes locks while sampling lock contention gives you lies. This is why the entire hot path -- from sampling through ring buffer write -- is allocation-free, lock-free, and uses only atomic operations. The ring buffer is the design centerpiece: it decouples the fast sampling thread from the slower transport thread without any synchronization primitives.

**Frame pointers are not guaranteed.** Modern compilers can omit frame pointers (`-fomit-frame-pointer`) to free up a register. Apple's system frameworks are compiled with frame pointers, but third-party code may not be. When the frame pointer chain is broken, our walk terminates early. We handle this gracefully (partial stack traces are still useful), but it is a fundamental limitation of frame-pointer-based unwinding versus DWARF-based unwinding.

**Canvas rendering at scale requires binning.** You cannot draw 100,000 individual rectangles per frame. The trick is to bin events into pixel-width buckets first, then draw one shape per bucket. This keeps the draw call count proportional to the screen width, not the event count.

## Try It

InstrumentsOS is open source under the MIT license.

```bash
# Clone and start the backend
git clone https://github.com/anthropics/instruments-os.git
cd instruments-os/ios/backend
pip install -r requirements.txt
python server.py

# In another terminal, start the viewer
cd instruments-os/ios/viewer
npm install
npm run dev

# Add the SDK to your iOS app as a Swift Package,
# then in your AppDelegate:
InstrumentsOS.configure(host: "YOUR_MAC_IP", port: 8765)
InstrumentsOS.startProfiling()
```

Open `http://localhost:5173` in your browser and you will see traces streaming in live.

## What's Next

This is a working profiler, but there is a lot more to build:

- **DWARF-based stack unwinding** for code compiled without frame pointers
- **Energy impact tracking** via `IOKit` battery APIs
- **Flame graph aggregation** in the viewer
- **Trace export** in Perfetto's protobuf format, so you can open InstrumentsOS traces in Perfetto's UI
- **CI integration** -- run a profiling session as part of your test suite, fail the build if P95 hitch duration exceeds a threshold

If any of this interests you, contributions are welcome. The SDK is ~800 lines of C, the backend is ~400 lines of Python, and the viewer is ~1200 lines of TypeScript. This is not a massive codebase -- you can read the whole thing in an afternoon.

Star the repo, file an issue, or open a PR. The iOS ecosystem deserves an open-source profiler.
