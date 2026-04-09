import type { Module } from '../types';

const module3: Module = {
  id: 'mod-3',
  number: 3,
  title: 'Chrome DevTools Deep Dive',
  description:
    'Performance panel, memory snapshots, flame charts — connecting what you already know to profiling fundamentals.',
  lessons: [
    {
      id: 'mod-3-lesson-1',
      title: "Chrome's Performance Tab Architecture",
      moduleId: 'mod-3',
      order: 1,
      content: [
        {
          type: 'text',
          content:
            "When you click **Record** in the Performance tab, Chrome doesn't just start watching your page. It orchestrates a complex pipeline involving the V8 JavaScript engine, the Blink rendering engine, the compositor, and the GPU process — all feeding timestamped trace events into a unified timeline.",
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Chrome DevTools is itself a web application. The Performance panel is built with the same HTML/CSS/JS you write daily — it just happens to consume profiling data from the browser internals via the Chrome DevTools Protocol (CDP).',
        },
        {
          type: 'text',
          content:
            "### What happens when you hit Record\n\n1. **DevTools sends a CDP command** (`Tracing.start`) to the browser process\n2. **Trace categories are enabled** — each category corresponds to a subsystem (V8, Blink, compositor, GPU)\n3. **V8's sampling profiler activates** — it interrupts JavaScript execution at ~1ms intervals and captures the current call stack\n4. **Blink emits rendering events** — layout, paint, style recalculation\n5. **The compositor and GPU process emit frame events** — when frames are produced and presented\n6. **All events flow into a shared trace buffer** as JSON-like trace event objects\n7. **When you stop recording**, the trace buffer is serialized and sent back to DevTools for visualization",
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    A[DevTools UI] -->|CDP: Tracing.start| B[Browser Process]\n    B --> C[V8 Sampling Profiler]\n    B --> D[Blink Rendering Events]\n    B --> E[Compositor Events]\n    B --> F[GPU Process Events]\n    C --> G[Trace Buffer]\n    D --> G\n    E --> G\n    F --> G\n    G -->|CDP: Tracing.end| H[DevTools Timeline UI]\n    H --> I[Main Track]\n    H --> J[Network Track]\n    H --> K[Frames Track]\n    H --> L[GPU Track]',
        },
        {
          type: 'text',
          content:
            "### The tracks you see\n\n- **Main track** — JavaScript execution, style/layout/paint, all on the main thread. This is where flame charts live.\n- **Network track** — HTTP requests with timing breakdown (DNS, connect, TTFB, content download).\n- **Frames track** — visual frame production. Dropped frames show as red.\n- **Rasterizer / GPU tracks** — off-main-thread rendering work.\n\nEach track is built from trace events with a **phase** (Begin, End, Instant, Complete), a **category**, a **timestamp**, and a **duration**. Chrome's flame chart is constructed by nesting events whose time ranges overlap — a Begin/End pair that contains another pair becomes its parent in the chart.",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'The Chrome trace format (JSON array of trace events) is documented and open. You can export a trace from DevTools, open it in a text editor, and see the raw events. Try it — understanding the data format demystifies the entire tool.',
        },
      ],
    },
    {
      id: 'mod-3-lesson-2',
      title: "V8's Sampling Profiler",
      moduleId: 'mod-3',
      order: 2,
      content: [
        {
          type: 'text',
          content:
            "V8's CPU profiler is a **sampling profiler**. It doesn't instrument your code or add hooks to every function — instead, it sets a timer that fires at regular intervals (default ~1ms) and captures whatever JavaScript call stack is active at that moment.",
        },
        {
          type: 'text',
          content:
            '### How sampling works\n\n1. A **POSIX signal** (or platform equivalent) fires every ~1ms\n2. The signal handler **suspends V8 execution** and reads the current stack\n3. Each sample records: **timestamp**, **JavaScript frames** (function name, script, line/column), and **native C++ frames** from V8 internals\n4. The sample is pushed into a circular buffer\n5. Execution resumes — total interruption is ~1-5 microseconds\n\nBecause sampling is statistical, functions that run for less than the sampling interval may be missed entirely. A function executing for 0.5ms has roughly a 50% chance of appearing in any given sample at 1ms intervals.',
        },
        {
          type: 'text',
          content:
            '### Self Time vs Total Time\n\nThese two metrics are fundamental to every profiler, not just Chrome:\n\n- **Total Time** — how long a function was on the stack (including time spent in functions it called)\n- **Self Time** — how long a function was at the **top** of the stack (doing its own work, not waiting for callees)\n\nFrom samples, these are calculated by counting:\n- **Total Time** = (number of samples where the function appears anywhere in the stack) x (sample interval)\n- **Self Time** = (number of samples where the function is the **topmost** JS frame) x (sample interval)',
        },
        {
          type: 'code',
          language: 'javascript',
          content:
            "// Example: How this appears in the profiler\nfunction processData(items) {\n  // Self time: ~0ms (just calls other functions)\n  const parsed = items.map(parseItem);     // Total time includes parseItem\n  const sorted = heavySort(parsed);         // Total time includes heavySort\n  return sorted;\n}\n\nfunction parseItem(item) {\n  // Self time: moderate (does real parsing work)\n  return JSON.parse(item.rawData);\n}\n\nfunction heavySort(arr) {\n  // Self time: HIGH (doing actual comparisons)\n  // This is where the profiler shows the hot spot\n  return arr.sort((a, b) => {\n    return expensiveComparison(a, b);\n  });\n}\n\n// In the profiler:\n// processData  — Total: 850ms, Self: 2ms\n// heavySort    — Total: 700ms, Self: 680ms  <-- the bottleneck\n// parseItem    — Total: 148ms, Self: 90ms",
        },
        {
          type: 'text',
          content:
            "### Bottom-Up vs Top-Down views\n\n**Top-Down (Call Tree)** starts from the entry point and drills into callees. It answers: \"Starting from main(), where does time flow?\"\n\n**Bottom-Up** inverts this — it starts from the functions with the highest self time and shows their callers. It answers: \"What functions are actually doing the work, and who called them?\"\n\nRule of thumb: **start with Bottom-Up** to find the hot functions, then switch to **Top-Down** to understand the call path that leads there.",
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'Sampling profilers have a blind spot: very short functions called millions of times may show less self time than expected because the sampler catches them inconsistently. If you suspect this, switch to a tracing/instrumentation approach (like console.time or User Timing API) for that specific function.',
        },
      ],
    },
    {
      id: 'mod-3-lesson-3',
      title: "Chrome's Memory Tools",
      moduleId: 'mod-3',
      order: 3,
      content: [
        {
          type: 'text',
          content:
            "Chrome DevTools provides three memory profiling tools, each answering a different question. Understanding which tool to reach for is more important than memorizing their interfaces.",
        },
        {
          type: 'comparison-table',
          headers: ['Tool', 'Question it answers', 'Data type'],
          rows: [
            ['Heap Snapshot', 'What objects exist right now?', 'Full object graph at a point in time'],
            ['Allocation Timeline', 'When were objects created?', 'Allocation events over time'],
            ['Allocation Sampling', 'Which functions allocate the most?', 'Statistical allocation attribution'],
          ],
        },
        {
          type: 'text',
          content:
            '### Heap Snapshots\n\nA heap snapshot captures **every reachable JavaScript object** and the references between them. V8 walks the entire object graph from GC roots (global scope, stack, handles) and records:\n\n- Object type, size (shallow and retained)\n- References to other objects\n- The retaining path from GC roots\n\n**Shallow size** = memory the object itself uses.\n**Retained size** = memory that would be freed if this object were garbage collected (including objects only reachable through it).',
        },
        {
          type: 'text',
          content:
            "### The Retainer Tree\n\nWhen you find a suspicious object, the retainer tree shows **why** it's still alive. It traces the chain of references from GC roots to your object. A memory leak is simply an object that has an unintended retaining path — something is holding a reference that should have been released.\n\nCommon leak patterns in web apps:\n- Event listeners not removed on component unmount\n- Closures capturing large scopes\n- Detached DOM nodes still referenced from JS\n- Growing Maps/Sets used as caches without eviction",
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    GC[GC Root: Window] --> A[EventEmitter]\n    A --> B[listeners array]\n    B --> C[Closure from removed component]\n    C --> D[Detached DOM Tree - 50MB]\n    style D fill:#992222,color:#ffffff\n    D --> E[Child nodes]\n    D --> F[Image data buffers]\n    GC --> G[Active component]\n    G --> H[Current DOM Tree]\n    style H fill:#226622,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### The Three Snapshot Technique\n\nThis is the most reliable method for finding memory leaks:\n\n1. **Snapshot 1** — Take a baseline heap snapshot\n2. **Perform the suspected leaking action** (e.g., navigate to a page and back, open/close a modal)\n3. **Snapshot 2** — Take another snapshot\n4. **Repeat the action** several more times\n5. **Snapshot 3** — Take a final snapshot\n\nNow compare Snapshot 3 to Snapshot 1 using the **Comparison** view. Objects that exist in Snapshot 3 but not Snapshot 1, and that grew between Snapshot 2 and 3, are likely leaks.\n\nThe reason for three snapshots instead of two: the first run often creates legitimate caches and lazy initializations. By the third snapshot, those one-time allocations are already present — only the leak remains as growth.",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'This three-snapshot approach is not Chrome-specific. The same conceptual technique works in Instruments\' Allocations instrument (using \"Mark Generation\") and in Android\'s memory profiler. The underlying principle — diff state before and after repeated actions — is universal.',
        },
      ],
    },
    {
      id: 'mod-3-lesson-4',
      title: 'From Chrome to Native Profilers',
      moduleId: 'mod-3',
      order: 4,
      content: [
        {
          type: 'text',
          content:
            "Everything you've learned in Chrome DevTools maps directly to concepts in native profilers. The vocabulary changes, the data sources get richer, but the mental models transfer. This lesson builds the bridge.",
        },
        {
          type: 'comparison-table',
          headers: ['Concept', 'Chrome DevTools', 'Apple Instruments', 'Android Studio Profiler'],
          rows: [
            ['CPU profiling', 'V8 sampling profiler', 'Time Profiler (kperf sampling)', 'CPU Profiler (ART sampling/tracing)'],
            ['Flame chart', 'Main track flame chart', 'Call tree + heavy stack trace', 'Flame chart in CPU recorder'],
            ['Memory snapshots', 'Heap Snapshot', 'Allocations instrument + Mark Generation', 'Heap dump'],
            ['Leak detection', 'Three Snapshot technique', 'Leaks instrument (automatic)', 'LeakCanary (library)'],
            ['Timeline', 'Performance recording', 'Instruments trace timeline', 'Timeline in profiler window'],
            ['Trace format', 'JSON trace events', '.trace bundle (columnar stores)', 'Perfetto protobuf'],
            ['Kernel access', 'None (user-space only)', 'Full (kdebug, kperf, dtrace)', 'Limited (Perfetto, simpleperf)'],
            ['Hardware counters', 'None', 'kperf PMC access', 'simpleperf PMC access'],
          ],
        },
        {
          type: 'text',
          content:
            "### What transfers directly\n\n- **Flame charts** are flame charts everywhere. The x-axis is time, the y-axis is stack depth, width is duration. Whether you're in Chrome, Instruments, or Perfetto, reading them is the same skill.\n- **Call trees** with self time and total time work identically.\n- **Timeline-based thinking** — recording a window of activity, then scrubbing through it — is the universal profiling workflow.\n- **Diffing state over time** — whether it's heap snapshots or allocation generations — is how you find leaks on any platform.",
        },
        {
          type: 'text',
          content:
            "### What's fundamentally different in native profilers\n\n**System-level access.** Chrome can only see what V8 and Blink expose. Native profilers like Instruments can see:\n- **Kernel scheduling decisions** — which thread ran on which CPU core and why\n- **System calls** — every interaction between your app and the OS kernel\n- **Virtual memory faults** — page-ins from disk, copy-on-write faults\n- **Hardware performance counters** — cache misses, branch mispredictions, instructions retired\n\n**Multi-process visibility.** Chrome DevTools profiles one tab's renderer process. Instruments can profile the entire system simultaneously — your app, system daemons, kernel threads, GPU work, all on one timeline.\n\n**Lower overhead options.** Native profilers can use kernel-level facilities (kperf on macOS, perf on Linux) that are designed for production use with negligible overhead.",
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph Chrome["Chrome DevTools (User-space)"\n    ]\n        C1[V8 Profiler] --> C2[Trace Events]\n        C3[Blink Events] --> C2\n        C2 --> C4[Timeline UI]\n    end\n    subgraph Instruments["Apple Instruments (Kernel + User-space)"\n    ]\n        I1[kperf / PMCs] --> I5[Trace Buffer]\n        I2[kdebug / syscalls] --> I5\n        I3[os_signpost] --> I5\n        I4[malloc hooks] --> I5\n        I5 --> I6[Analysis Core]\n        I6 --> I7[Track-based UI]\n    end\n    C4 -.->|Same mental model| I7\n    style Chrome fill:#1a1a2e,color:#ffffff\n    style Instruments fill:#1a2e1a,color:#ffffff',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            "Your Chrome DevTools experience isn't just \"nice to have\" for this internship. Apple's Instruments team values people who understand profiling as a discipline. You already think in timelines, call trees, and flame charts. The iOS-specific pieces (XNU kernel, kdebug, os_signpost) are details you'll layer on top of foundations you already have.",
        },
      ],
    },
  ],
  quiz: {
    moduleId: 'mod-3',
    questions: [
      {
        id: 'mod-3-q-1',
        question:
          "What protocol does Chrome DevTools use to start a performance recording in the browser?",
        options: [
          'WebSocket direct connection to V8',
          'Chrome DevTools Protocol (CDP) via Tracing.start',
          'A shared memory buffer between renderer and DevTools',
          'Direct function calls into the Blink rendering engine',
        ],
        correctIndex: 1,
        explanation:
          'Chrome DevTools communicates with the browser via the Chrome DevTools Protocol (CDP). When you click Record, it sends a Tracing.start command that activates trace categories across V8, Blink, the compositor, and the GPU process. CDP is also what tools like Puppeteer and Playwright use to automate Chrome.',
      },
      {
        id: 'mod-3-q-2',
        question:
          "In a sampling profiler like V8's, a function with 0ms self time but 500ms total time indicates what?",
        options: [
          'The function is a bottleneck that needs optimization',
          'The function is an orchestrator that delegates all real work to its callees',
          'The profiler failed to capture samples for that function',
          'The function was optimized away by the JIT compiler',
        ],
        correctIndex: 1,
        explanation:
          'Self time measures how long a function was at the TOP of the call stack doing its own work. Total time includes time spent in callees. A function with 0ms self time but 500ms total time is purely an orchestrator — it calls other functions that do the real work. To optimize, you need to look at its callees, not the function itself.',
      },
      {
        id: 'mod-3-q-3',
        question:
          "What is \"retained size\" in a Chrome heap snapshot?",
        options: [
          'The size of the object itself in memory',
          'The total memory that would be freed if this object were garbage collected',
          'The size of all objects of the same type',
          'The maximum size the object has ever been',
        ],
        correctIndex: 1,
        explanation:
          "Retained size is the total memory that would be freed if an object were garbage collected — including all objects that are ONLY reachable through it. This is different from shallow size (the object's own memory). An object with a small shallow size but a huge retained size is likely the root of a significant memory subgraph.",
      },
      {
        id: 'mod-3-q-4',
        question:
          'Why does the Three Snapshot technique use three snapshots instead of two?',
        options: [
          'Three provides statistical significance for sampling',
          'The first action creates legitimate caches — the third snapshot isolates true leaks from one-time initialization',
          'Chrome requires at least three snapshots for comparison mode',
          'Two snapshots cannot show retained size differences',
        ],
        correctIndex: 1,
        explanation:
          'The first time you perform an action, lazy initialization and caching create legitimate allocations. If you only compared snapshots 1 and 2, you\'d see these one-time costs mixed in with actual leaks. By repeating the action and taking a third snapshot, those one-time allocations are already present — only the per-action leak growth remains as the delta between snapshot 2 and 3.',
      },
      {
        id: 'mod-3-q-5',
        question:
          'What is the most significant capability that native profilers (like Instruments) have over Chrome DevTools?',
        options: [
          'Better flame chart rendering',
          'More colors in the timeline',
          'Kernel-level access: scheduling, syscalls, hardware counters, VM faults',
          'Ability to profile JavaScript and CSS simultaneously',
        ],
        correctIndex: 2,
        explanation:
          'The fundamental difference is system-level access. Chrome DevTools can only see what V8 and Blink expose — it operates entirely in user space within a sandboxed renderer process. Native profilers like Instruments access kernel facilities (kdebug, kperf) to see thread scheduling, system calls, virtual memory faults, and hardware performance counters. This visibility is essential for understanding performance at the system level.',
      },
      {
        id: 'mod-3-q-6',
        question:
          'Which Chrome DevTools concept maps DIRECTLY to Instruments\' "Mark Generation" feature in the Allocations instrument?',
        options: [
          'The Performance panel recording',
          'The Network waterfall',
          'The Three Snapshot technique for heap comparison',
          'The Bottom-Up call tree view',
        ],
        correctIndex: 2,
        explanation:
          "Mark Generation in Instruments' Allocations instrument lets you place markers during a recording and compare allocations between generations — this is the direct equivalent of Chrome's Three Snapshot technique. Both isolate leaked objects by comparing object populations across user-defined boundaries. The concept is identical; only the mechanism differs.",
      },
    ],
    passingScore: 70,
    xpReward: 100,
  },
};

export default module3;
