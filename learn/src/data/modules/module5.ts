import type { Module } from '../types';

const module5: Module = {
  id: 'mod-5',
  number: 5,
  title: 'iOS & Apple Instruments',
  description:
    'XNU kernel, kdebug, os_signpost, Instruments architecture, custom instruments — the deep knowledge for the internship.',
  lessons: [
    {
      id: 'mod-5-lesson-1',
      title: 'XNU Kernel & Darwin',
      moduleId: 'mod-5',
      order: 1,
      content: [
        {
          type: 'text',
          content:
            "macOS, iOS, watchOS, and tvOS all run on Darwin, Apple's open-source operating system foundation. At its core is XNU — a hybrid kernel that combines two very different kernel architectures into one.",
        },
        {
          type: 'text',
          content:
            '### XNU = X is Not Unix (but also kind of is)\n\nXNU is a hybrid of:\n\n- **Mach** — a microkernel from Carnegie Mellon University. Handles the lowest-level abstractions: threads, tasks (Mach\'s term for a process), virtual memory, inter-process communication (IPC) via message-passing ports.\n- **BSD** — specifically FreeBSD. Provides the POSIX-compatible layer: file systems, networking, user/group permissions, signals, the `syscall` interface that apps actually use.\n- **I/O Kit** — Apple\'s C++ framework for device drivers.\n\nThe key insight: apps primarily interact with the BSD layer (POSIX APIs), but profiling tools often need the Mach layer for thread-level control.',
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph Userspace["User Space"]\n        A[Your App]\n        B[System Frameworks]\n        C[Instruments / Profiler]\n    end\n    subgraph Kernel["XNU Kernel"]\n        subgraph BSD["BSD Layer"]\n            D[File Systems]\n            E[Networking]\n            F[POSIX APIs]\n            G[Process Model]\n        end\n        subgraph Mach["Mach Microkernel"]\n            H[Tasks & Threads]\n            I[Virtual Memory]\n            J[IPC / Ports]\n            K[Scheduling]\n        end\n        subgraph IOKit["I/O Kit"]\n            L[Device Drivers]\n        end\n    end\n    subgraph Hardware["Hardware"]\n        M[CPU / Apple Silicon]\n        N[Memory / MMU]\n        O[Devices]\n    end\n    A --> F\n    B --> F\n    C --> H\n    C --> J\n    F --> H\n    G --> H\n    H --> M\n    I --> N\n    L --> O\n    style Userspace fill:#1a1a2e,color:#ffffff\n    style Kernel fill:#1a2e1a,color:#ffffff\n    style Hardware fill:#2e1a1a,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### Mach primitives that matter for profiling\n\n**Tasks** — Mach's equivalent of a process. A task owns a virtual address space and a set of ports. Every BSD process has an underlying Mach task.\n\n**Threads** — the unit of execution. Each Mach thread has register state, a stack, and scheduling attributes. Profilers enumerate threads via `task_threads()`.\n\n**Ports** — the IPC mechanism. Ports are message queues protected by capabilities. Instruments uses Mach ports to communicate with target processes and system services.\n\n**Key APIs for profiling:**\n- `task_threads()` — enumerate all threads in a task\n- `thread_suspend()` / `thread_resume()` — pause a thread to inspect its state\n- `thread_get_state()` — read a thread's CPU registers (including the instruction pointer and frame pointer, which let you walk the call stack)",
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            "This is exactly how Sentry built their iOS profiler. They use task_threads() to enumerate threads, thread_suspend() to pause each one, thread_get_state() to read the instruction pointer and frame pointer, then walk the stack frame by frame. It's the same technique Apple's own Time Profiler uses — and it's how our InstrumentsOS SDK will capture stack samples.",
        },
        {
          type: 'text',
          content:
            "### Why Mach thread suspension instead of signals?\n\nOn Linux, profilers commonly use `SIGPROF` or `timer_create` signals to interrupt threads for sampling. On Apple platforms, Mach thread suspension is preferred because:\n\n1. **Signal handlers run in the target thread's context** — if that thread is in a bad state (holding a lock, in the middle of malloc), the signal handler can deadlock\n2. **Mach suspension is immediate and unconditional** — the thread stops exactly where it is\n3. **You can read another thread's registers externally** via `thread_get_state()` — no need to execute code in the target thread\n4. **It works on all threads**, including those blocked in kernel calls\n\nThis is a critical design decision that comes up in Apple profiling interviews.",
        },
      ],
    },
    {
      id: 'mod-5-lesson-2',
      title: 'kdebug, os_signpost & Tracing APIs',
      moduleId: 'mod-5',
      order: 2,
      content: [
        {
          type: 'text',
          content:
            "Apple's tracing infrastructure has two main layers: **kdebug** (the kernel-level trace buffer) and **os_signpost** (the modern app-level instrumentation API). Understanding both is essential because Instruments consumes data from both.",
        },
        {
          type: 'text',
          content:
            "### kdebug: The kernel trace buffer\n\nkdebug is a kernel facility that maintains a ring buffer of timestamped trace events. Each event is compact:\n\n- **Timestamp** — nanosecond-precision Mach absolute time\n- **Debug ID** — a 32-bit code identifying the event type (class, subclass, code)\n- **Arguments** — up to 4 machine-word-sized arguments\n- **Thread ID** — which thread emitted the event\n\nThe kernel itself emits kdebug events for system calls, VM faults, interrupts, scheduling decisions, and I/O operations. This is the raw data that Instruments' System Trace instrument visualizes.\n\nUser-space code can also emit kdebug events via `kdebug_trace()`, though Apple recommends os_signpost for application instrumentation.",
        },
        {
          type: 'text',
          content:
            "### os_signpost: Modern app instrumentation\n\nos_signpost is built on top of os_log and is Apple's recommended API for adding custom instrumentation to your app. It's what you use when you want your own events to appear in Instruments.\n\nTwo types of signposts:\n\n- **`.event`** — a single point in time (\"this thing happened\")\n- **`.begin` / `.end`** — bracket a time interval (\"this operation took this long\")\n\nSignposts are organized by:\n- **Log handle** — identifies the subsystem and category\n- **Signpost name** — a static string identifying what's being measured\n- **Signpost ID** — distinguishes concurrent instances of the same operation",
        },
        {
          type: 'code',
          language: 'swift',
          content:
            'import os\n\n// Create a log handle for your subsystem\nlet networkLog = OSLog(\n    subsystem: "com.myapp.networking",\n    category: "URLRequests"\n)\n\n// Create a signpost ID for this specific request\nlet requestID = OSSignpostID(log: networkLog)\n\n// Mark the beginning of a network request\nos_signpost(\n    .begin,\n    log: networkLog,\n    name: "NetworkRequest",\n    signpostID: requestID,\n    "GET %{public}s", url.absoluteString\n)\n\n// ... perform the network request ...\n\n// Mark the end\nos_signpost(\n    .end,\n    log: networkLog,\n    name: "NetworkRequest",\n    signpostID: requestID,\n    "Status: %d, bytes: %d", statusCode, responseSize\n)',
        },
        {
          type: 'text',
          content:
            '### Performance characteristics\n\nos_signpost is designed for production use:\n- **< 1 microsecond per signpost** when Instruments is not recording\n- When no profiler is attached, signposts are effectively no-ops (the os_log system short-circuits)\n- Format strings are NOT evaluated unless a consumer is actively recording\n- This means you can leave signposts in production code with negligible overhead',
        },
        {
          type: 'mermaid',
          content:
            'sequenceDiagram\n    participant App as Your App\n    participant Log as os_log system\n    participant KB as Kernel Trace Buffer\n    participant KT as ktrace\n    participant Inst as Instruments\n    App->>Log: os_signpost(.begin, ...)\n    Log->>KB: Write trace event to kdebug buffer\n    App->>Log: os_signpost(.end, ...)\n    Log->>KB: Write trace event to kdebug buffer\n    KT->>KB: Read events from buffer\n    KT->>Inst: Stream events to Instruments\n    Inst->>Inst: Match begin/end into intervals\n    Inst->>Inst: Display on Points of Interest track',
        },
        {
          type: 'text',
          content:
            "### ktrace: Userspace control\n\nInstruments reads kdebug events via `ktrace` — a userspace facility that controls the kernel trace buffer. When Instruments starts recording:\n\n1. It calls `ktrace_session_create()` to set up a tracing session\n2. Configures which event classes to capture (syscalls, VM faults, signposts, etc.)\n3. The kernel writes matching events to the trace buffer\n4. Instruments reads events from the buffer in real-time\n5. Events flow into the Analysis Core for processing and display\n\nThis is why Instruments needs elevated privileges (or a development-signed app) — `ktrace` requires authorization to read kernel trace data.",
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'kdebug and os_signpost are Apple-private at the implementation level — the kernel interfaces are not stable public API. os_signpost is the stable public API for app developers. Instruments uses private interfaces internally. For our InstrumentsOS SDK, we will use the public Mach APIs (task_threads, thread_get_state) rather than the private kdebug interfaces.',
        },
      ],
    },
    {
      id: 'mod-5-lesson-3',
      title: 'Apple Instruments Architecture',
      moduleId: 'mod-5',
      order: 3,
      content: [
        {
          type: 'text',
          content:
            "Instruments is not a single tool — it's a framework for building profiling tools. Understanding its three-layer architecture reveals why it's so powerful and where InstrumentsOS draws inspiration.",
        },
        {
          type: 'text',
          content:
            '### Layer 1: Recording\n\nThe recording layer collects raw data from multiple sources simultaneously:\n\n- **kdebug / ktrace** — kernel trace events (syscalls, scheduling, VM faults)\n- **kperf** — kernel performance counters, timer-triggered stack sampling (this is what Time Profiler uses)\n- **os_signpost** — app-level custom instrumentation\n- **malloc hooks** — heap allocation/deallocation tracking (for Allocations instrument)\n- **XPC services** — out-of-process recording daemons that can outlive the profiled app\n- **Core Graphics / Metal hooks** — frame rendering data\n\nThe "binding solution" is a critical concept: when you start recording, Instruments determines which data sources the currently-active instruments need and **only enables those**. Running Time Profiler? Only kperf sampling is activated. Running System Trace? kdebug is enabled for the relevant event classes. This keeps overhead minimal.',
        },
        {
          type: 'text',
          content:
            "### Layer 2: Analysis Core\n\nRaw events from the recording layer flow into the Analysis Core — a hybrid system combining:\n\n- **A columnar data store** — efficiently stores millions of trace events with timestamps\n- **CLIPS rules engine** — a forward-chaining inference engine (originally from NASA) that transforms raw events into higher-level concepts\n\nFor example, the Allocations instrument receives raw `malloc()` and `free()` events. CLIPS rules match allocation/free pairs, calculate object lifetimes, identify leaks (allocations never freed), and produce the structured data that the UI displays.\n\nThe Analysis Core is what makes Instruments more than a trace viewer — it's a trace **analyzer**. Raw events become meaningful insights through rules-based processing.",
        },
        {
          type: 'text',
          content:
            '### Layer 3: Standard UI\n\nThe Standard UI framework provides the consistent interface across all instruments:\n\n- **Track-based timeline** — horizontal tracks, synchronized to a global time axis. Each instrument gets one or more tracks.\n- **Detail views** — tables, outlines, call trees below the timeline. Content depends on the selected instrument and time range.\n- **Inspector** — extended details for the selected item.\n- **Time range selection** — drag on the timeline to filter detail views to a specific interval.\n\nThis three-layer separation is what allows custom instruments to exist. A custom instrument only needs to define: what data to collect (recording sources), how to process it (CLIPS rules / modelers), and what columns to show (table schemas). The Standard UI handles everything else.',
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph Recording["Layer 1: Recording"]\n        R1[kperf - Stack Sampling]\n        R2[kdebug - Kernel Events]\n        R3[os_signpost - App Events]\n        R4[malloc hooks - Allocations]\n        R5[XPC Services]\n    end\n    subgraph Binding["Binding Solution"]\n        BS[Enable only needed sources]\n    end\n    subgraph Analysis["Layer 2: Analysis Core"]\n        A1[Columnar Data Store]\n        A2[CLIPS Rules Engine]\n        A3[Modelers]\n    end\n    subgraph UI["Layer 3: Standard UI"]\n        U1[Track Timeline]\n        U2[Detail Views / Call Trees]\n        U3[Inspector]\n    end\n    R1 --> BS\n    R2 --> BS\n    R3 --> BS\n    R4 --> BS\n    R5 --> BS\n    BS --> A1\n    A1 --> A2\n    A2 --> A3\n    A3 --> U1\n    A3 --> U2\n    U1 --> U3\n    U2 --> U3\n    style Recording fill:#2e2e1a,color:#ffffff\n    style Binding fill:#2e1a1a,color:#ffffff\n    style Analysis fill:#1a2e1a,color:#ffffff\n    style UI fill:#1a1a2e,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### The .trace file format\n\nWhen you save an Instruments recording, it creates a `.trace` file — which is actually a **directory bundle** (like .app bundles). Inside:\n\n- **Columnar data stores** — binary files optimized for time-series queries\n- **Run metadata** — target app, device info, recording duration\n- **Instrument configurations** — which instruments were active\n- **Analysis results** — pre-computed aggregations\n\nThis bundle format allows Instruments to open large traces efficiently — it can memory-map specific columns without loading the entire file. Traces from hours-long recording sessions can be hundreds of megabytes but still open quickly because of this columnar design.",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Right-click any .trace file in Finder and select "Show Package Contents" to explore the internal structure. You\'ll see the columnar stores, instrument definitions, and metadata that make up a recording. Understanding this file format helps demystify what Instruments is actually storing.',
        },
      ],
    },
    {
      id: 'mod-5-lesson-4',
      title: 'Key Instruments Deep Dive',
      moduleId: 'mod-5',
      order: 4,
      content: [
        {
          type: 'text',
          content:
            "Instruments ships with dozens of instrument templates, but a handful are used constantly. This lesson covers the instruments you're most likely to discuss in an interview and use on the job.",
        },
        {
          type: 'text',
          content:
            "### Time Profiler\n\nThe most-used instrument. It uses **kperf** to sample call stacks at 1ms intervals across all threads.\n\n- **Call tree aggregation** — samples are merged into a weighted call tree. If function A appears in 300 out of 1000 samples, it has 30% total time.\n- **Heavy (Bottom Up) view** — starts from the \"heaviest\" leaf functions (highest self time) and traces callers upward. This is usually where you start.\n- **Top Down view** — starts from thread entry points and shows where time flows into callees.\n- **Charge to caller** — collapses system framework functions so your app code appears as the bottleneck, not `objc_msgSend`.\n\nTime Profiler corresponds directly to Chrome's sampling profiler and Android's CPU sample profiler. The concepts are identical.",
        },
        {
          type: 'text',
          content:
            '### Allocations\n\nTracks every `malloc()`, `free()`, and Objective-C/Swift object allocation and deallocation.\n\n- **All Allocations** — every allocation event with timestamp, size, responsible stack trace\n- **Mark Generation** — place markers during recording to compare allocations between time periods (equivalent to Chrome\'s Three Snapshot technique)\n- **Transient vs Persistent** — transient objects were allocated and freed within the recording; persistent objects still exist. Persistent objects that grow with repeated user actions are potential leaks.\n- **Allocation categories** — grouped by type (NSString, UIView, CGImage, etc.) with instance counts and sizes',
        },
        {
          type: 'text',
          content:
            "### Leaks\n\nPeriodically scans the heap for objects with no root reference — true reference-counting leaks.\n\n- Takes **periodic snapshots** of all allocated memory\n- Scans for **objects that can't be reached from any root** (stack, globals, autorelease pools)\n- Shows the **reference chain** from the leaked object back toward (non-existent) roots\n- Particularly effective for **Objective-C retain cycle** detection\n\nNote: Leaks detects true leaks (unreachable memory). It does NOT detect \"logical leaks\" — objects that are still reachable but shouldn't be (like a growing cache). For those, use Allocations with Mark Generation.",
        },
        {
          type: 'text',
          content:
            "### System Trace\n\nThe most comprehensive instrument. It records kdebug events to show:\n\n- **Thread scheduling** — when each thread was running, blocked, or preempted, and why\n- **System calls** — every syscall with arguments and return values\n- **Virtual memory faults** — page-ins, copy-on-write faults, zero-fills\n- **Interrupts and context switches**\n\nSystem Trace answers questions that other instruments can't: \"Why was my thread blocked for 16ms?\" (Answer: waiting on a lock held by a background thread that was preempted by a higher-priority system process.)",
        },
        {
          type: 'text',
          content:
            "### Swift Concurrency Instrument (Xcode 16+)\n\nA newer instrument specifically for async/await and actors:\n\n- **Task Forest** — visualizes structured concurrency as a tree of tasks\n- **Task Timeline** — shows when each task is running, suspended, or waiting\n- **Actor Contention** — highlights when tasks block waiting for actor access\n\nThis is particularly relevant as Swift concurrency adoption grows — performance issues in async code are notoriously hard to debug without dedicated tooling.",
        },
        {
          type: 'text',
          content:
            '### SwiftUI Instrument (Xcode 16+)\n\n- **Body invocation tracking** — shows when and why each View\'s `body` is re-evaluated\n- **Cause & effect graph** — traces from a state change to the views it invalidated\n- **Update coalescing** — shows how SwiftUI batches updates\n\nThis instrument is a direct window into the SwiftUI runtime — something that was previously opaque.',
        },
        {
          type: 'mermaid',
          content:
            'flowchart LR\n    subgraph DataSource["Data Sources"]\n        DS1[kperf sampling]\n        DS2[malloc/free hooks]\n        DS3[Heap scans]\n        DS4[kdebug events]\n        DS5[Swift runtime hooks]\n    end\n    subgraph Instrument["Instruments"]\n        I1[Time Profiler]\n        I2[Allocations]\n        I3[Leaks]\n        I4[System Trace]\n        I5[Swift Concurrency]\n    end\n    subgraph Output["Primary Output"]\n        O1[Weighted call tree]\n        O2[Allocation timeline + categories]\n        O3[Leaked object graphs]\n        O4[Thread state timeline]\n        O5[Task forest + actor contention]\n    end\n    DS1 --> I1 --> O1\n    DS2 --> I2 --> O2\n    DS3 --> I3 --> O3\n    DS4 --> I4 --> O4\n    DS5 --> I5 --> O5',
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            "In interviews, don't just name instruments — explain the data source each one uses. \"Time Profiler uses kperf to sample call stacks at 1ms intervals\" shows deeper understanding than \"Time Profiler profiles CPU usage.\"",
        },
      ],
    },
    {
      id: 'mod-5-lesson-5',
      title: 'Custom Instruments & CLIPS',
      moduleId: 'mod-5',
      order: 5,
      content: [
        {
          type: 'text',
          content:
            "Apple Instruments isn't just a fixed set of profiling tools — it's an extensible framework. Since Xcode 10, developers can create custom instruments using the `.instrpkg` format. Understanding this system reveals Apple's philosophy about profiling extensibility.",
        },
        {
          type: 'text',
          content:
            "### The .instrpkg format\n\nA custom instrument is defined in an XML file (`.instrpkg`) that specifies:\n\n1. **Instrument definition** — metadata, icon, category\n2. **Data source binding** — what recording source to use (usually os_signpost)\n3. **Schema definition** — table structure for the processed data\n4. **Modeler** — CLIPS rules or auto-generated patterns that transform raw events into table rows\n5. **UI layout** — which graphs and detail views to show",
        },
        {
          type: 'text',
          content:
            "### CLIPS: A rules engine from NASA\n\nCLIPS (C Language Integrated Production System) was developed at NASA's Johnson Space Center in the 1980s for expert systems. Apple adopted it as the data processing engine in Instruments' Analysis Core.\n\nCLIPS is a **forward-chaining rule-based system**:\n- **Facts** are asserted into a working memory (trace events become facts)\n- **Rules** match patterns in facts and produce new facts or actions\n- The engine continuously matches rules against the current fact base until no more rules fire\n\nIn Instruments, CLIPS rules transform raw trace events (os_signpost begin/end pairs, malloc/free calls) into structured table rows that the UI displays.",
        },
        {
          type: 'text',
          content:
            '### Engineering types\n\nInstruments schemas use **engineering types** — strongly-typed columns that carry semantic meaning:\n\n- `duration` — a time interval with appropriate unit display\n- `size-in-bytes` — memory sizes with automatic KB/MB/GB formatting\n- `thread` — a thread identifier with name resolution\n- `backtrace` — a call stack with symbolication\n- `narrative` — formatted description text\n\nThese types mean the UI automatically knows how to display, sort, and filter data without custom rendering code.',
        },
        {
          type: 'text',
          content:
            '### Auto-generated modelers\n\nFor the common case of os_signpost-based instruments, Apple provides auto-generated modelers. If your signposts follow a consistent pattern, Instruments can automatically:\n\n- Match `.begin` / `.end` pairs into intervals\n- Extract fields from the format string arguments\n- Populate table schemas\n\nThis means creating a basic custom instrument can be as simple as: add os_signpost calls to your code, define a schema, and let the auto-modeler handle the transformation.',
        },
        {
          type: 'code',
          language: 'xml',
          content:
            '<!-- Simplified custom instrument definition (.instrpkg) -->\n<package>\n  <id>com.myapp.network-instrument</id>\n  <title>Network Request Profiler</title>\n\n  <!-- Define the data table schema -->\n  <os-signpost-interval-schema>\n    <id>network-request-schema</id>\n    <title>Network Requests</title>\n\n    <subsystem>"com.myapp.networking"</subsystem>\n    <category>"URLRequests"</category>\n    <name>"NetworkRequest"</name>\n\n    <!-- Columns extracted from signpost arguments -->\n    <start-pattern>\n      <message>"GET " ?url</message>\n    </start-pattern>\n    <end-pattern>\n      <message>"Status: " ?status-code ", bytes: " ?size</message>\n    </end-pattern>\n\n    <column>\n      <mnemonic>url</mnemonic>\n      <title>URL</title>\n      <type>string</type>\n    </column>\n    <column>\n      <mnemonic>status-code</mnemonic>\n      <title>Status</title>\n      <type>uint32</type>\n    </column>\n    <column>\n      <mnemonic>size</mnemonic>\n      <title>Response Size</title>\n      <type>size-in-bytes</type>\n    </column>\n  </os-signpost-interval-schema>\n\n  <!-- Define the instrument -->\n  <instrument>\n    <id>com.myapp.instrument.network</id>\n    <title>Network Requests</title>\n    <category>Network</category>\n    <create-table>\n      <id>network-request-table</id>\n      <schema-ref>network-request-schema</schema-ref>\n    </create-table>\n    <!-- Graph and detail view definitions follow -->\n  </instrument>\n</package>',
        },
        {
          type: 'text',
          content:
            "### Why this matters\n\nCustom instruments reveal Apple's extensibility philosophy:\n\n1. **Declarative over imperative** — you describe what data you want, not how to collect it\n2. **Leverage existing infrastructure** — custom instruments use the same recording, analysis, and UI layers as built-in instruments\n3. **Signpost-first design** — os_signpost is the bridge between your code and Instruments\n\nThis is also relevant for InstrumentsOS: we want the same extensibility. Our architecture should let users define custom \"instruments\" that consume trace data and produce meaningful views.",
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Apple\'s WWDC sessions on custom instruments (WWDC 2018: "Creating Custom Instruments", WWDC 2019: "Developing a Great Profiling Experience") are essential viewing. They walk through the .instrpkg format and CLIPS rules with live demos. These sessions demonstrate the engineering depth that the Instruments team values.',
        },
      ],
    },
    {
      id: 'mod-5-lesson-6',
      title: "What We're Building: InstrumentsOS",
      moduleId: 'mod-5',
      order: 6,
      content: [
        {
          type: 'text',
          content:
            "Everything in this course has been building toward this: InstrumentsOS — an open-source profiling toolkit for iOS that combines the best architectural ideas from across the industry. This lesson connects every concept you've learned to what we're building.",
        },
        {
          type: 'text',
          content:
            "### The gap we're filling\n\n- **Perfetto** exists for Android/Linux — open-source, SQL-queryable, excellent architecture. Nothing equivalent exists for iOS.\n- **Apple Instruments** is powerful but proprietary, closed-source, and macOS-only. You can't embed it in CI, query traces programmatically, or extend the analysis pipeline.\n- **Sentry's iOS profiler** proved that Mach-level sampling works as an SDK. But it's a monitoring tool, not an analysis platform.\n\nInstrumentsOS aims to be **Perfetto for iOS** — an open-source profiling toolkit with Apple Instruments' UX philosophy.",
        },
        {
          type: 'text',
          content:
            '### Our three layers\n\n**Layer 1: SDK (C/Objective-C)**\nA lightweight library that apps link against. It uses the Mach APIs you learned about in Lesson 1:\n\n- `task_threads()` to enumerate threads\n- `thread_suspend()` / `thread_resume()` to pause threads safely\n- `thread_get_state()` to read register state\n- Stack frame walking via frame pointer chain\n- Minimal overhead: designed for profileable/release builds\n\n**Layer 2: Python Backend**\nIngests trace data from the SDK and exposes it for analysis:\n\n- Trace file parsing and storage\n- SQL-queryable trace database (inspired by Perfetto\'s Trace Processor)\n- Symbol resolution and stack unwinding\n- Aggregation and analysis primitives\n\n**Layer 3: Web Viewer**\nA browser-based UI for exploring trace data:\n\n- Track-based timeline (inspired by Instruments\' Standard UI)\n- Flame charts and call trees\n- SQL query interface (inspired by Perfetto\'s web UI)\n- Shareable traces — just a URL',
        },
        {
          type: 'mermaid',
          content:
            'flowchart TD\n    subgraph SDK["Layer 1: SDK - C/ObjC"]\n        S1["task_threads() - Thread enumeration"]\n        S2["thread_get_state() - Register capture"]\n        S3[Frame pointer stack walking]\n        S4[os_signpost integration]\n        S1 --> S5[Trace Buffer]\n        S2 --> S5\n        S3 --> S5\n        S4 --> S5\n    end\n    subgraph Backend["Layer 2: Python Backend"]\n        B1[Trace File Parser]\n        B2[SQLite Trace Database]\n        B3[Symbol Resolution]\n        B4[Analysis Engine]\n    end\n    subgraph Viewer["Layer 3: Web Viewer"]\n        V1[Track Timeline]\n        V2[Flame Chart]\n        V3[SQL Query Interface]\n        V4[Call Tree Views]\n    end\n    S5 -->|Protobuf trace file| B1\n    B1 --> B2\n    B2 --> B3\n    B3 --> B4\n    B4 -->|REST API| V1\n    B4 -->|REST API| V2\n    B4 -->|Query results| V3\n    B4 -->|REST API| V4\n    style SDK fill:#2e1a1a,color:#ffffff\n    style Backend fill:#1a2e1a,color:#ffffff\n    style Viewer fill:#1a1a2e,color:#ffffff',
        },
        {
          type: 'text',
          content:
            "### How this connects to what you've learned\n\nEvery module in this course directly informs InstrumentsOS:",
        },
        {
          type: 'comparison-table',
          headers: ['Module', 'What you learned', 'How it applies to InstrumentsOS'],
          rows: [
            [
              'OS Fundamentals',
              'Processes, threads, memory, scheduling',
              'SDK uses Mach tasks/threads; trace data includes scheduling events',
            ],
            [
              'Profiling Fundamentals',
              'Sampling vs instrumentation, flame charts, call trees',
              'SDK implements sampling; viewer renders flame charts and call trees',
            ],
            [
              'Chrome DevTools',
              'Trace events, flame charts, memory snapshots',
              'Viewer UX inspired by Chrome\'s timeline; JSON trace export compatibility',
            ],
            [
              'Android / Perfetto',
              'SQL-queryable traces, protobuf format, three-layer architecture',
              'Backend uses SQL analysis; trace format is protobuf; architecture mirrors Perfetto',
            ],
            [
              'iOS / Instruments',
              'XNU/Mach APIs, kdebug, os_signpost, Instruments architecture',
              'SDK built on Mach APIs; integrates with os_signpost; three-layer design mirrors Instruments',
            ],
          ],
        },
        {
          type: 'text',
          content:
            "### What makes this novel\n\n1. **No open-source \"Perfetto for iOS\" exists** — Android has Perfetto, Linux has perf + Perfetto. iOS developers have no open-source equivalent.\n2. **SQL-queryable iOS traces** — imagine running `SELECT * FROM stack_sample WHERE symbol LIKE '%viewDidLoad%'` on your iOS profiling data.\n3. **CI-friendly** — no Xcode required for analysis. Profile in CI, query results programmatically, detect regressions automatically.\n4. **Cross-platform viewer** — browser-based, shareable via URL. No macOS required to view traces.",
        },
        {
          type: 'text',
          content:
            "### How this demonstrates internship-relevant skills\n\nWhen you discuss this project in your interview, you're demonstrating:\n\n- **Deep understanding of Apple's platform** — XNU, Mach APIs, os_signpost, Instruments architecture\n- **Cross-platform perspective** — you've studied Chrome, Android, and iOS profiling and synthesized the best ideas\n- **Systems programming** — the SDK is C/ObjC working with kernel APIs, not just high-level Swift\n- **Architecture taste** — you can articulate why Perfetto's SQL model + Instruments' UX is the right combination\n- **Open-source thinking** — you identified a gap in the ecosystem and proposed a solution",
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            "You've now completed the full learning path: OS fundamentals, profiling theory, Chrome (your home turf), Android (cross-pollination), and iOS/Instruments (your target). The InstrumentsOS project ties everything together into a single artifact that demonstrates your understanding. The quizzes that follow are interview-grade — treat them as practice for the real thing.",
        },
      ],
    },
  ],
  quiz: {
    moduleId: 'mod-5',
    questions: [
      {
        id: 'mod-5-q-1',
        question:
          'What kernel facility does Apple Instruments primarily use to collect trace data?',
        options: [
          'DTrace probes',
          'POSIX signals (SIGPROF)',
          'kdebug kernel trace buffer',
          'sysctl system information interface',
        ],
        correctIndex: 2,
        explanation:
          "kdebug is the kernel-level trace buffer that Instruments primarily uses. It provides nanosecond-precision timestamped events for system calls, VM faults, scheduling decisions, and user-space signposts. While DTrace exists on macOS, Instruments' core data collection is built on kdebug (accessed via ktrace). The kdebug infrastructure is what enables Instruments' System Trace, and os_signpost events flow through kdebug as well.",
      },
      {
        id: 'mod-5-q-2',
        question:
          "Why does Sentry's iOS profiler use Mach thread suspension instead of POSIX signal handlers for stack sampling?",
        options: [
          'Signal handlers are not available on iOS',
          'Mach suspension is faster than signal delivery',
          'Signal handlers run in the target thread context and can deadlock; Mach suspension is unconditional and allows external register reading',
          'Apple requires Mach APIs for App Store approval',
        ],
        correctIndex: 2,
        explanation:
          "POSIX signal handlers execute within the target thread's context. If that thread holds a lock (e.g., malloc's internal lock), the signal handler can deadlock if it tries to allocate memory or call any function that acquires the same lock. Mach thread suspension stops the thread unconditionally from outside, and thread_get_state() reads registers without executing any code in the target thread. This is safer and more reliable for production profilers.",
      },
      {
        id: 'mod-5-q-3',
        question:
          'What is the Analysis Core in Apple Instruments?',
        options: [
          'The CPU profiling engine that samples call stacks',
          'A hybrid system combining a columnar data store with a CLIPS rules engine that transforms raw events into structured analysis data',
          "The kernel module that collects trace data",
          "Instruments' main UI rendering framework",
        ],
        correctIndex: 1,
        explanation:
          "The Analysis Core sits between the recording layer and the UI. It combines a columnar data store (efficient time-series storage for millions of events) with CLIPS (a NASA-developed forward-chaining rules engine) that transforms raw trace events into meaningful data. For example, raw malloc/free events become allocation lifetimes, leak reports, and categorized object graphs. This is what makes Instruments an analyzer rather than just a trace viewer.",
      },
      {
        id: 'mod-5-q-4',
        question:
          'Name two differences between os_signpost and kdebug.',
        options: [
          'os_signpost is for iOS only; kdebug is for macOS only',
          'os_signpost is the stable public API for app instrumentation with format strings and signpost IDs; kdebug is the kernel-level trace buffer with compact fixed-size events and debug IDs',
          'os_signpost is synchronous; kdebug is asynchronous',
          'os_signpost requires Instruments; kdebug works standalone',
        ],
        correctIndex: 1,
        explanation:
          "os_signpost is Apple's recommended public API for app-level instrumentation. It supports rich format strings, named subsystems/categories, and typed signpost IDs. Under the hood, os_signpost events flow through the os_log system into the kdebug buffer. kdebug itself is the kernel-level trace facility with compact 32-byte events containing a debug ID and up to 4 machine-word arguments. os_signpost is high-level and stable; kdebug is low-level and implementation-private.",
      },
      {
        id: 'mod-5-q-5',
        question:
          'What happens during the "binding solution" phase when Instruments starts recording?',
        options: [
          'Instruments compiles the CLIPS rules into native code',
          'The target app is recompiled with profiling hooks',
          'Instruments determines which recording data sources the active instruments need and enables only those, minimizing overhead',
          'Symbol tables are loaded from dSYM files',
        ],
        correctIndex: 2,
        explanation:
          "The binding solution is Instruments' strategy for keeping overhead low. Instead of enabling all possible data sources (which would be expensive), it examines which instruments are active in the current recording template and enables only the recording sources they require. Time Profiler only needs kperf sampling; Allocations only needs malloc hooks; System Trace only needs kdebug. This selective activation is why Instruments can be low-overhead despite its comprehensive capabilities.",
      },
      {
        id: 'mod-5-q-6',
        question:
          'What is the XNU kernel, and what two major components is it a hybrid of?',
        options: [
          'A Linux-based kernel combining ext4 and FUSE',
          'A hybrid of the Mach microkernel (threads, tasks, IPC, VM) and BSD (file systems, networking, POSIX APIs)',
          'A combination of ARM and x86 instruction decoders',
          'A hybrid of LLVM and GCC compiler backends',
        ],
        correctIndex: 1,
        explanation:
          "XNU (X is Not Unix) is Apple's kernel used across all Apple platforms. It combines the Mach microkernel from Carnegie Mellon (which provides low-level abstractions: tasks, threads, ports/IPC, virtual memory management) with a FreeBSD-derived layer (which provides POSIX compatibility: file systems, networking, signals, the syscall interface). Apps use the BSD layer; profilers often need the Mach layer for thread-level control.",
      },
      {
        id: 'mod-5-q-7',
        question:
          'What is CLIPS, and why does Apple use it in Instruments?',
        options: [
          'A GPU shader language used for rendering flame charts',
          'A forward-chaining rules engine from NASA, used to transform raw trace events into structured analysis data via pattern matching',
          'A compression algorithm for .trace files',
          'A C++ library for parsing kernel debug events',
        ],
        correctIndex: 1,
        explanation:
          "CLIPS (C Language Integrated Production System) was developed at NASA's Johnson Space Center for building expert systems. It's a forward-chaining inference engine: facts are asserted (trace events), rules match patterns in facts and produce new facts or actions. Apple uses it in Instruments' Analysis Core to transform raw events (malloc/free calls, signpost begin/end pairs) into structured, meaningful data (allocation lifetimes, interval durations, leak graphs). It's a declarative approach to trace analysis.",
      },
      {
        id: 'mod-5-q-8',
        question:
          'What Mach API would you use to read a suspended thread\'s instruction pointer for stack sampling?',
        options: [
          'thread_info()',
          'thread_get_state()',
          'task_info()',
          'mach_port_get_context()',
        ],
        correctIndex: 1,
        explanation:
          "thread_get_state() reads a thread's machine-dependent register state, including the instruction pointer (PC/IP) and frame pointer (FP/BP). This is the critical API for stack sampling: you suspend the thread with thread_suspend(), read its registers with thread_get_state(), walk the frame pointer chain to build the call stack, then resume with thread_resume(). This is the technique used by Sentry's profiler and Apple's Time Profiler.",
      },
      {
        id: 'mod-5-q-9',
        question:
          'What is the .trace file format in Apple Instruments?',
        options: [
          'A single JSON file containing all trace events',
          'A SQLite database with predefined tables',
          'A directory bundle containing columnar data stores, instrument configurations, and analysis metadata',
          'A protobuf-encoded binary stream',
        ],
        correctIndex: 2,
        explanation:
          'A .trace file is actually a directory bundle (similar to .app bundles). Inside, it contains columnar data stores optimized for time-series queries, instrument configurations defining what was recorded, run metadata (target app, device, duration), and pre-computed analysis results. The columnar format allows Instruments to memory-map specific data columns without loading the entire trace, enabling efficient analysis of even multi-gigabyte recordings.',
      },
      {
        id: 'mod-5-q-10',
        question:
          'Why is there no open-source "Perfetto for iOS," and what architectural approach does InstrumentsOS take to fill this gap?',
        options: [
          'Apple prohibits open-source profiling tools; InstrumentsOS uses jailbreak APIs',
          "iOS doesn't expose any profiling APIs; InstrumentsOS emulates them in user space",
          "Apple's tracing infrastructure is proprietary; InstrumentsOS uses public Mach APIs for collection, Perfetto's SQL-queryable model for analysis, and Instruments' UX philosophy for the viewer",
          'Perfetto already works on iOS; InstrumentsOS just adds a better UI',
        ],
        correctIndex: 2,
        explanation:
          "While Apple provides powerful tracing (kdebug, os_signpost, Instruments), the infrastructure is proprietary and closed-source. No open-source equivalent exists for iOS like Perfetto does for Android/Linux. InstrumentsOS fills this gap by using public Mach APIs (task_threads, thread_get_state) for data collection (the same approach Sentry validated), Perfetto's SQL-queryable trace database concept for analysis, and Instruments' track-based timeline UX for the web viewer. This combines proven ideas from both ecosystems into an open-source toolkit.",
      },
    ],
    passingScore: 70,
    xpReward: 300,
  },
};

export default module5;
