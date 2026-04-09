# InstrumentsOS Design Spec

**Date**: 2026-04-09
**Status**: Approved
**Author**: Sagar Saurabh

## Purpose

Build an open-source iOS performance profiling tool inspired by Apple Instruments and Google Perfetto.

## Problem Statement

No open-source "Perfetto for iOS" exists. Existing tools are either:
- Closed-source and IDE-locked (Apple Instruments, Android Studio Profiler)
- Narrow in scope (ETTrace: main thread only, Sentry: production APM only)
- Not iOS-focused (Perfetto: Android/Linux only)

InstrumentsOS fills this gap with an end-to-end profiling system: lightweight SDK, Python backend, and web-based trace viewer.

## Architecture

Three-layer separation mirroring Apple Instruments:

```
Recording (iOS SDK) --> Analysis (Python Backend) --> Presentation (Web Viewer)
```

### Layer 1: iOS SDK (C/ObjC + Swift wrapper)

Embeds in the target iOS app. Collects performance data with minimal overhead.

**Components:**
- **CPU Sampler**: 100Hz sampling via Mach thread suspension (`thread_suspend`, `thread_get_state`, frame pointer walking). Captures call stacks for all threads.
- **Memory Tracker**: `malloc_zone_t` interposition to track allocation size and sampled call stacks. Reports live bytes, allocation rate, peak usage.
- **Hitch Detector**: `CADisplayLink` callback measures frame delivery timing. Records hitch events when gap exceeds 33ms (missed frame). Captures main thread stack at hitch time.
- **GPU Tracker**: Hooks `MTLDevice` creation via method swizzling. Wraps `MTLCommandBuffer` submissions to record timing (enqueue → commit → scheduled → completed). Samples `MTLDevice.currentAllocatedSize` for GPU memory. Reads `MTLCounterSampleBuffer` for GPU utilization on supported hardware. Core ML inference timing captured automatically via signpost bridge (Core ML emits `os_signpost` events).
- **Signpost Bridge**: Observes `os_signpost` events from the app's log subsystem. Forwards begin/end intervals to the ring buffer. Captures Core ML inference events automatically.
- **Ring Buffer**: Lock-free single-producer single-consumer circular buffer. Fixed size (configurable, default 64MB). Oldest events overwritten when full.
- **Transport**: WebSocket client streams JSON events to the Python backend over WiFi.

**Public API (Swift):**
```swift
import InstrumentsOS

// In AppDelegate or @main
InstrumentsOS.configure(host: "192.168.1.5", port: 8765)
InstrumentsOS.startProfiling()

// Optional: custom signposts
InstrumentsOS.signpost(.begin, name: "image-load", id: photoId)
InstrumentsOS.signpost(.end, name: "image-load", id: photoId)
```

**Overhead target**: < 5% CPU, < 10MB memory.

### Layer 2: Python Backend

Runs on the developer's Mac. Receives, processes, stores, and serves trace data.

**Components:**
- **WebSocket Server**: Accepts SDK connections, receives JSON events.
- **Trace Processor**: Deduplicates stack frames, computes time deltas, groups by event type.
- **Symbolizer**: Uses Apple's `atos` command to convert raw addresses to function names. Requires dSYM path. Caches results in SQLite.
- **Trace Store**: SQLite with tables for events, stacks, symbols, sessions. Indexed by timestamp for fast time-range queries.
- **REST API**: Serves processed data to the web viewer.

**API endpoints:**
- `GET /api/sessions` — list recorded sessions
- `GET /api/traces/:id/timeline?start=&end=` — events in time range
- `GET /api/traces/:id/flamechart?start=&end=` — aggregated stacks for flame chart
- `GET /api/traces/:id/calltree` — call tree data (top-down/bottom-up)
- `WebSocket /ws/live` — live event streaming to viewer during recording

**Stack**: Python 3.11+, `websockets`, `aiohttp`, `sqlite3`.

### Layer 3: Web Viewer (React + Canvas)

Browser-based trace viewer. The primary showcase of the project.

**Canvas Timeline:**
- HTML Canvas 2D for timeline tracks (not DOM — performance critical)
- Multi-track view: CPU, Memory, Hitches, Signposts on shared time axis
- Pan/zoom with mouse (wheel = zoom, drag = pan)
- Inspection range: click-drag to select time window, all views filter to it
- Level-of-detail: zoom out shows density, zoom in shows individual events

**Track Types:**
- CPU Track: stacked area chart, per-thread CPU usage, color-coded
- Memory Track: line graph of live bytes over time
- Hitch Track: colored bars (green < 100ms, yellow < 500ms, red > 500ms)
- GPU Track: GPU utilization %, GPU memory, command buffer timeline, ML inference intervals
- Signpost Track: labeled intervals with begin/end markers

**Detail Panel (bottom pane):**
- Flame Chart tab: call stacks over time for selected range
- Call Tree tab: aggregated top-down / bottom-up with self-time / total-time
- Events tab: raw event list, searchable, filterable

**Stack**: Vite + React + TypeScript + Tailwind + shadcn. Canvas 2D rendering.

### Demo App ("BuggyApp")

SwiftUI iOS app with deliberate performance bugs:

1. **MainThreadBlocker**: Synchronous URLSession on main thread. Causes 2-3s severe hang.
2. **MemoryLeaker**: Timer strong-referencing self in closure. Memory grows ~1MB/sec.
3. **HitchGenerator**: Heavy CIFilter processing inside ScrollView body. 200-500ms hitches.
4. **NetworkSpammer**: 100 concurrent URLSession requests. Visible in signpost track.
5. **MLHog**: Runs Core ML inference synchronously on main thread. Saturates GPU, causes UI hitch + GPU spike visible simultaneously in GPU and Hitch tracks.

Each bug maps to a specific viewer track, making the demo self-explanatory.

## Data Flow

```
iOS App                    Mac (Host)                    Browser
───────                    ──────────                    ───────
SDK collects event    -->  Backend receives via WS  -->  Viewer fetches via REST
  (sampling thread)          (processor + symbolizer)      (Canvas renders timeline)
Ring buffer stores    -->  SQLite stores traces     -->  Detail panel shows call tree
Transport streams     -->  REST API serves data     -->  User identifies bug
```

## Trace Event Format (JSON)

```json
{
  "type": "cpu_sample",
  "timestamp_ns": 1234567890123,
  "thread_id": 42,
  "thread_name": "main",
  "frames": [
    { "address": "0x100003a40", "symbol": null },
    { "address": "0x100002b10", "symbol": null }
  ]
}

{
  "type": "hitch",
  "timestamp_ns": 1234567890123,
  "duration_ms": 45.2,
  "severity": "micro_hang",
  "main_thread_stack": [...]
}

{
  "type": "memory",
  "timestamp_ns": 1234567890123,
  "live_bytes": 52428800,
  "allocation_rate_bps": 1048576,
  "peak_bytes": 67108864
}

{
  "type": "signpost",
  "timestamp_ns": 1234567890123,
  "event": "begin",
  "name": "image-load",
  "signpost_id": "photo_42"
}

{
  "type": "gpu_command_buffer",
  "timestamp_ns": 1234567890123,
  "label": "render_pass_0",
  "gpu_start_ns": 1234567890100,
  "gpu_end_ns": 1234567894500,
  "gpu_duration_ms": 4.4,
  "encoder_type": "render"
}

{
  "type": "gpu_memory",
  "timestamp_ns": 1234567890123,
  "allocated_bytes": 134217728,
  "peak_bytes": 268435456
}

{
  "type": "gpu_utilization",
  "timestamp_ns": 1234567890123,
  "utilization_pct": 87.5,
  "vertex_count": 42000,
  "fragment_count": 1920000
}
```

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| SDK core | C | Required for Mach APIs, minimal overhead, no runtime dependency |
| SDK ObjC parts | Objective-C | CADisplayLink, os_log, malloc zone APIs |
| SDK wrapper | Swift | Clean public API for Swift developers |
| Backend | Python | Fast to develop, `atos` integration, good WebSocket libs |
| Viewer | React + Canvas | Web plays to developer's strengths, Canvas for perf |
| Storage | SQLite | Zero-config, time-range queries, portable |
| Transport | WebSocket + JSON | Simple, debuggable, works over WiFi |
| Package manager | Swift Package Manager | Modern, standard for iOS libraries |

## Scope & Priorities

### Must Have (Week 1-2)
- CPU Sampler with Mach thread suspension
- Ring buffer + WebSocket transport
- Python backend with basic processing
- Canvas timeline with CPU track
- Basic flame chart view

### Should Have (Week 3)
- Memory tracker
- Hitch detector
- GPU tracker (command buffer timing + GPU memory + ML inference via signposts)
- Symbolication via atos
- All five track types in viewer (CPU, Memory, Hitches, GPU, Signposts)
- Call tree detail view

### Nice to Have (Week 4)
- Signpost bridge (custom developer signposts beyond Core ML)
- Demo app with all 5 bug types (including MLHog — on-device inference on main thread)
- GPU hardware counters via MTLCounterSampleBuffer (device-dependent)
- Live streaming mode
- Session save/load
- Polish + blog post

### Out of Scope
- Per-shader GPU profiling (needs private API)
- Neural Engine profiling (ANE has no public API)
- Profiling arbitrary apps (only SDK-embedded)
- Custom instruments framework (CLIPS equivalent)
- Production/release profiling mode
- Android support

## Success Criteria

1. Demo video: record BuggyApp → open viewer → identify all 5 bugs in timeline (including GPU/ML)
2. GitHub repo with clean README, architecture docs, screenshots
3. Blog post on Medium explaining the technical approach + on-device ML profiling angle
4. Able to discuss Mach APIs, Metal command buffers, sampling vs tracing, flame charts in interview
