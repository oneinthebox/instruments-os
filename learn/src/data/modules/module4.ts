import type { Module } from '../types';

const module4: Module = {
  id: 'mod-4',
  number: 4,
  title: 'Android Profiling',
  description:
    'Android Studio Profiler, Perfetto, ART runtime — profiling on mobile and what it teaches us about building InstrumentsOS.',
  lessons: [
    {
      id: 'mod-4-lesson-1',
      title: 'Android Studio Profiler Architecture',
      moduleId: 'mod-4',
      order: 1,
      content: [
        {
          type: 'text',
          content:
            "Android Studio Profiler is an IDE-integrated profiling suite that gives you real-time visibility into CPU, memory, network, and energy consumption of a running Android app. Unlike standalone profilers, it's embedded directly in the development environment — you profile while you code.",
        },
        {
          type: 'text',
          content:
            '### The four profilers\n\n- **CPU Profiler** — method tracing, function sampling, system trace (via Perfetto)\n- **Memory Profiler** — heap dumps, allocation tracking, leak detection\n- **Network Profiler** — HTTP request/response timeline with payload inspection\n- **Energy Profiler** — estimated battery impact from CPU, network, GPS, wakelocks',
        },
        {
          type: 'text',
          content:
            "### Two profiling modes\n\n**Debuggable** (debug builds): Full access. The profiler agent runs inside your app process with unrestricted access to the ART runtime. Higher overhead but complete data.\n\n**Profileable** (release builds): Added in Android 10. The `<profileable>` manifest tag allows profiling without debug overhead. The profiler connects via a lightweight transport layer with limited but sufficient access. This is critical for profiling production-representative performance — debug builds are often 2-10x slower due to disabled optimizations.",
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph Device["Android Device"]\n        A[Your App Process] --> B[ART Runtime]\n        B --> C[Profiler Agent]\n        C --> D[Transport Layer]\n        D --> E[adbd daemon]\n    end\n    subgraph Host["Development Machine"]\n        E -->|USB/WiFi| F[ADB Server]\n        F --> G[Android Studio]\n        G --> H[CPU Profiler UI]\n        G --> I[Memory Profiler UI]\n        G --> J[Network Profiler UI]\n        G --> K[Energy Profiler UI]\n    end\n    style Device fill:#1a2e1a,color:#ffffff\n    style Host fill:#1a1a2e,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### Comparison to Apple Instruments\n\nBoth are IDE-adjacent profiling tools, but the architecture differs significantly:\n\n- **Android**: Profiler agent lives inside the app process (ART runtime hooks). Data flows over ADB to the host.\n- **Instruments**: Recording infrastructure lives in the kernel and system daemons. The profiled app doesn't need to be modified — Instruments observes from outside using kernel facilities.\n\nThis is the fundamental architectural difference: Android profiles from inside the process, Apple profiles from outside (and above) it. Both have trade-offs. Inside gives you richer application-level data; outside gives you system-level context without perturbing the target.",
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            "Android's approach of injecting a profiler agent is similar to how Java profilers (JProfiler, YourKit) work on desktop. Apple's approach of external observation via kernel tracing is closer to Linux's perf and DTrace. Both lineages are worth understanding.",
        },
      ],
    },
    {
      id: 'mod-4-lesson-2',
      title: 'Perfetto: The Open-Source Backbone',
      moduleId: 'mod-4',
      order: 2,
      content: [
        {
          type: 'text',
          content:
            "Perfetto is Google's open-source tracing system. It's the backbone of Android system tracing, Chrome's `about:tracing`, and an increasing number of Linux performance tools. Understanding Perfetto matters because our InstrumentsOS project takes direct architectural inspiration from it.",
        },
        {
          type: 'text',
          content:
            '### Three components\n\n**1. Tracing SDK** — A C++ library that apps and system services link against to emit trace events. It supports:\n- Track events (similar to Chrome trace events)\n- Custom data sources (define your own trace schema)\n- Efficient shared-memory transport (no copies, no syscalls on the hot path)\n\n**2. Traced daemon** — Runs on the device, coordinates tracing sessions. It manages:\n- Which data sources are active\n- Ring buffers and flush policies\n- Writing traces to disk\n- Consumer/producer coordination\n\n**3. Trace Processor + UI** — Analysis tools:\n- **Trace Processor**: Ingests trace files and exposes them as a SQL database\n- **Web UI**: ui.perfetto.dev — browser-based visualization\n- **Command-line tools**: `trace_processor_shell` for scripted analysis',
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph Producers["Data Producers"]\n        P1[App Code via SDK]\n        P2[ART Runtime]\n        P3[Kernel ftrace]\n        P4[GPU Drivers]\n    end\n    subgraph Daemon["traced (On-Device Daemon)"]\n        D1[Session Manager]\n        D2[Shared Memory Buffers]\n        D3[Ring Buffer Policy]\n    end\n    subgraph Analysis["Analysis (Host or Cloud)"]\n        A1[Trace Processor]\n        A2[SQLite Engine]\n        A3[Perfetto UI]\n    end\n    P1 -->|Shared memory| D2\n    P2 -->|Shared memory| D2\n    P3 -->|ftrace pipe| D2\n    P4 -->|Shared memory| D2\n    D1 --> D2\n    D2 --> D3\n    D3 -->|.perfetto-trace file| A1\n    A1 --> A2\n    A2 -->|Query results| A3\n    style Producers fill:#2e2e1a,color:#ffffff\n    style Daemon fill:#1a2e1a,color:#ffffff\n    style Analysis fill:#1a1a2e,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### SQL-based trace analysis\n\nThis is Perfetto's most revolutionary feature. Instead of clicking through a UI to find information, you query your trace data with SQL:",
        },
        {
          type: 'code',
          language: 'sql',
          content:
            "-- Find the top 10 longest slices (spans of execution)\nSELECT name, dur / 1e6 as dur_ms, track_id\nFROM slice\nORDER BY dur DESC\nLIMIT 10;\n\n-- Find all thread scheduling events where a thread waited > 10ms\nSELECT ts, dur / 1e6 as wait_ms, thread.name\nFROM sched_slice\nJOIN thread USING (utid)\nWHERE dur > 10e6\nORDER BY dur DESC;\n\n-- Memory usage over time\nSELECT ts, value / 1e6 as rss_mb\nFROM counter\nJOIN counter_track ON counter.track_id = counter_track.id\nWHERE counter_track.name = 'mem.rss';",
        },
        {
          type: 'text',
          content:
            "### The protobuf trace format\n\nPerfetto traces use Protocol Buffers (protobuf) encoding — a compact binary format. This is a deliberate choice over Chrome's legacy JSON trace format:\n\n- **~10x smaller** file sizes for equivalent data\n- **Streaming writes** — no need to hold the entire trace in memory\n- **Strongly typed** — schema evolution without breaking compatibility\n- **Extensible** — new trace data sources can define new protobuf messages without changing the core format",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Go to ui.perfetto.dev right now and load one of the example traces. Run a SQL query in the Query tab. This hands-on experience with Perfetto\'s query model will directly inform how we build the analysis layer of InstrumentsOS. Our project uses the same "trace data as a queryable database" philosophy.',
        },
      ],
    },
    {
      id: 'mod-4-lesson-3',
      title: 'ART Runtime Profiling',
      moduleId: 'mod-4',
      order: 3,
      content: [
        {
          type: 'text',
          content:
            "The Android Runtime (ART) is to Android what V8 is to Chrome — the execution engine for application code. ART compiles Java/Kotlin bytecode to native machine code (ahead-of-time since Android 5.0, with profile-guided recompilation since Android 7.0). Its built-in profiling hooks are what Android Studio's CPU Profiler relies on.",
        },
        {
          type: 'text',
          content:
            '### Method Tracing\n\nART can instrument every method entry and exit, recording exact timestamps. This gives you:\n\n- **Precise call counts** — exactly how many times each method was called\n- **Exact timing** — wall clock and CPU time for every invocation\n- **Complete call graph** — every caller-callee relationship\n\nThe cost: **5-100x slowdown**. Method tracing adds overhead to every single method call. The profiled execution may not represent real-world performance. Use it to understand call structure, not to measure absolute timings.',
        },
        {
          type: 'text',
          content:
            "### Sample Profiling\n\nLike V8's sampling profiler, ART can periodically capture the current call stack:\n\n- Configurable interval (default varies, typically 1ms)\n- Much lower overhead than method tracing (~5-10%)\n- Statistical — short methods may be underrepresented\n- Better for measuring where time is actually spent",
        },
        {
          type: 'text',
          content:
            '### Simpleperf: Native Profiling\n\nFor C/C++ code (NDK), ART profiling is insufficient — you need `simpleperf`, Android\'s native profiler built on Linux `perf_event_open`. It can:\n\n- Sample CPU hardware counters (cycles, cache misses, branch mispredictions)\n- Capture both native and Java stacks (unwinding through JNI)\n- Generate flame graphs\n- Profile system-wide, not just one app',
        },
        {
          type: 'comparison-table',
          headers: ['Mode', 'Overhead', 'Data', 'Best for'],
          rows: [
            [
              'Method Tracing',
              'Very high (5-100x)',
              'Exact call counts, precise timing, complete call graph',
              'Understanding call structure, finding unexpected method calls',
            ],
            [
              'Sample Profiling',
              'Low (~5-10%)',
              'Statistical stack samples, self/total time',
              'Finding CPU hot spots in production-like conditions',
            ],
            [
              'System Trace (Perfetto)',
              'Very low (<1%)',
              'Scheduling, syscalls, binder transactions, custom events',
              'Diagnosing jank, threading issues, system-level bottlenecks',
            ],
            [
              'Simpleperf',
              'Low (~5%)',
              'HW counters, native + Java stacks',
              'Native code profiling, cache/branch analysis',
            ],
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            "Notice the parallel to what we covered in Module 2 (Sampling vs Instrumentation): method tracing is instrumentation (complete but expensive), sample profiling is sampling (statistical but cheap). Every platform faces this same trade-off. Apple Instruments' Time Profiler is a sampler; its System Trace is closer to method tracing for syscalls.",
        },
      ],
    },
    {
      id: 'mod-4-lesson-4',
      title: 'What Android Does Better (and Worse)',
      moduleId: 'mod-4',
      order: 4,
      content: [
        {
          type: 'text',
          content:
            "Having used both Android Studio Profiler and observed Apple Instruments, you're in a unique position to evaluate the design trade-offs each platform made. This lesson is about extracting lessons for InstrumentsOS.",
        },
        {
          type: 'text',
          content:
            "### What Android does better\n\n**Perfetto's SQL queries.** The ability to query trace data with SQL is transformative. Instead of clicking through UI panels hoping to find the right view, you write a precise query. This enables:\n- Automated performance regression detection in CI\n- Custom metrics that don't exist in the default UI\n- Scriptable analysis pipelines\n- Sharing queries as \"performance recipes\" across a team\n\n**Profileable mode.** Being able to profile release builds with near-zero overhead is essential for catching performance issues that only manifest without debug flags. Apple has equivalents (Instruments can attach to release builds), but Android's explicit `<profileable>` tag makes the intent clearer.\n\n**Open-source tracing.** Perfetto is fully open-source with excellent documentation. Anyone can extend it, embed it, or learn from its implementation. Apple's tracing infrastructure is proprietary — you can use the APIs (os_signpost, kdebug) but can't see how Instruments processes the data.",
        },
        {
          type: 'text',
          content:
            "### What Android does worse\n\n**UI coherence.** Android Studio Profiler's UI is functional but fragmented. CPU, Memory, Network, and Energy feel like four separate tools stitched together. Instruments provides a unified timeline where all data sources coexist on synchronized tracks — you can see a memory spike correlated with a CPU spike and a network request on one screen.\n\n**Startup experience.** Getting a useful profiling session in Android Studio requires navigating multiple configuration dialogs, choosing between recording modes, and often restarting the profiling session when you picked the wrong mode. Instruments lets you pick a template (Time Profiler, Allocations, etc.) and immediately records.\n\n**System-level integration.** Despite Perfetto's power, Android's Linux kernel tracing is more limited than macOS's kdebug/kperf/DTrace. App sandbox restrictions mean you see less of the system. Apple's tight hardware-software integration gives Instruments visibility that Android tools can't match.",
        },
        {
          type: 'mermaid',
          content:
            'flowchart LR\n    subgraph Android["Android Strengths"]\n        A1[SQL-queryable traces]\n        A2[Open-source Perfetto]\n        A3[Profileable mode]\n        A4[CI integration]\n    end\n    subgraph Apple["Instruments Strengths"]\n        B1[Unified timeline UI]\n        B2[Kernel-level access]\n        B3[HW-SW integration]\n        B4[Template-based UX]\n    end\n    subgraph InstrumentsOS["InstrumentsOS: Best of Both"]\n        C1[SQL queries from Perfetto]\n        C2[Open-source from Perfetto]\n        C3[Unified UI from Instruments]\n        C4[Track-based timeline from Instruments]\n    end\n    A1 --> C1\n    A2 --> C2\n    B1 --> C3\n    B2 --> C4\n    style Android fill:#1a2e1a,color:#ffffff\n    style Apple fill:#1a1a2e,color:#ffffff\n    style InstrumentsOS fill:#2e1a2e,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### Lessons for InstrumentsOS\n\nOur project aims to combine the best ideas from both ecosystems:\n\n| From Perfetto | From Instruments |\n|---|---|\n| SQL-queryable trace data | Track-based unified timeline |\n| Open-source, extensible | Polished template-based UX |\n| Protobuf trace format | Tight platform integration |\n| CI-friendly analysis | Low-overhead kernel-level collection |\n\nThe insight: Perfetto solved the **analysis** problem brilliantly (query your data, script your analysis). Instruments solved the **experience** problem brilliantly (unified view, one-click templates, everything correlated). No one has combined both for the iOS ecosystem with an open-source approach. That's our gap.",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            "When discussing InstrumentsOS in your internship interview, frame it as: \"I studied what Perfetto does well (queryable trace analysis, open-source) and what Instruments does well (unified UX, kernel integration) and asked: what would it look like to bring Perfetto's analysis philosophy to the Apple ecosystem?\"",
        },
      ],
    },
  ],
  quiz: {
    moduleId: 'mod-4',
    questions: [
      {
        id: 'mod-4-q-1',
        question:
          'What is the key difference between "debuggable" and "profileable" modes in Android profiling?',
        options: [
          'Debuggable is for Java, profileable is for native code',
          'Debuggable provides full access with high overhead; profileable allows profiling release builds with lower overhead',
          'Debuggable uses Perfetto, profileable uses simpleperf',
          'Debuggable works over USB, profileable works over WiFi',
        ],
        correctIndex: 1,
        explanation:
          'Debuggable mode (debug builds) gives the profiler agent full access to the ART runtime but disables compiler optimizations, resulting in 2-10x slower execution. Profileable mode (release builds, Android 10+) allows profiling with near-production performance. This distinction matters because performance characteristics in debug builds often don\'t match production.',
      },
      {
        id: 'mod-4-q-2',
        question:
          "What makes Perfetto's trace analysis approach fundamentally different from traditional profiler UIs?",
        options: [
          'It uses a web-based interface instead of a native application',
          'It stores traces in protobuf instead of JSON',
          'It exposes trace data as a SQL-queryable database, enabling programmatic analysis',
          'It supports more trace event categories than other tools',
        ],
        correctIndex: 2,
        explanation:
          "Perfetto's Trace Processor converts trace files into a SQLite database that you can query directly. This is revolutionary because it enables: scripted analysis, CI integration, custom metrics, and sharable query recipes. Traditional profilers require manual UI interaction to extract insights. This SQL-based approach is a key architectural inspiration for InstrumentsOS.",
      },
      {
        id: 'mod-4-q-3',
        question:
          'Why does ART method tracing cause 5-100x slowdown?',
        options: [
          'It writes trace data to disk synchronously',
          'It disables the JIT compiler entirely',
          'It instruments every single method entry and exit with timestamp recording',
          'It forces garbage collection between method calls',
        ],
        correctIndex: 2,
        explanation:
          'Method tracing adds instrumentation code at every method entry and exit point. For an app that calls millions of methods per second, this overhead is enormous. Each instrumented call records a timestamp, thread ID, and method identifier. The overhead scales with call frequency, which is why methods called in tight loops experience the worst slowdown. Use sampling profiling for realistic timing data.',
      },
      {
        id: 'mod-4-q-4',
        question:
          "What are Perfetto's three main architectural components?",
        options: [
          'Compiler, runtime, and debugger',
          'Tracing SDK (data collection), traced daemon (on-device coordination), Trace Processor + UI (analysis)',
          'Producer, consumer, and broker',
          'Sampler, tracer, and visualizer',
        ],
        correctIndex: 1,
        explanation:
          "Perfetto has three layers: the Tracing SDK (a C++ library that apps link against to emit trace events via shared memory), the traced daemon (runs on device, manages sessions and buffers), and the Trace Processor + UI (ingests trace files into a SQL database and provides web-based visualization). This clean separation of collection, coordination, and analysis is the architecture InstrumentsOS adapts.",
      },
      {
        id: 'mod-4-q-5',
        question:
          'Which tool would you use to profile C/C++ native code on Android with hardware performance counter access?',
        options: [
          'Android Studio CPU Profiler with method tracing',
          'Perfetto with ftrace data source',
          'simpleperf (built on Linux perf_event_open)',
          'ART sample profiler',
        ],
        correctIndex: 2,
        explanation:
          'simpleperf is Android\'s native profiler, built on the Linux perf_event_open system call. It can sample hardware performance counters (CPU cycles, cache misses, branch mispredictions) and capture both native C/C++ and Java stacks (unwinding through JNI boundaries). The ART-based profilers only see Java/Kotlin code; Perfetto\'s ftrace sees kernel events but not app-level call stacks with the same granularity.',
      },
      {
        id: 'mod-4-q-6',
        question:
          "What is the primary architectural difference between how Android Studio profiles an app vs how Apple Instruments profiles an app?",
        options: [
          'Android uses sampling, Apple uses instrumentation',
          "Android injects a profiler agent inside the app process; Apple observes from outside via kernel-level facilities",
          'Android profiles on-device, Apple profiles on the host machine',
          'Android profiles one app, Apple profiles the entire system',
        ],
        correctIndex: 1,
        explanation:
          "Android Studio Profiler works by injecting an agent into the app process that hooks into the ART runtime from the inside. Instruments primarily observes from outside the process using kernel facilities (kdebug, kperf) — the app doesn't need modification. This is a fundamental architectural difference: inside-out vs outside-in. Android's approach gives richer app-level data; Apple's gives system-level context without perturbing the target. Both have valid trade-offs.",
      },
    ],
    passingScore: 70,
    xpReward: 100,
  },
};

export default module4;
