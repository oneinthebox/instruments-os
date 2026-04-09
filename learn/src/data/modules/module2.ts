import type { Module } from '../types';

const module2: Module = {
  id: 'mod-2',
  number: 2,
  title: 'Profiling Fundamentals',
  description:
    'What profiling is, why it matters, and the universal concepts behind CPU, memory, and I/O profiling.',
  lessons: [
    // ──────────────────────────────────────────────
    // Lesson 1 — What Is Profiling?
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-1',
      title: 'What Is Profiling?',
      moduleId: 'mod-2',
      order: 1,
      content: [
        {
          type: 'text',
          content:
            '# What Is Profiling?\n\n' +
            'Profiling is the act of **measuring where your program spends its time, memory, and other resources** while it runs. ' +
            'You already use `console.log` timestamps and Chrome\'s Network tab to get rough answers. ' +
            'A profiler automates that measurement and gives you structured, precise data instead of guesswork.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Profiling is not debugging. Debugging asks "why does this crash?" Profiling asks "why is this slow?" They overlap, but they are different disciplines with different tools.',
        },
        {
          type: 'text',
          content:
            '## The Three Questions\n\n' +
            'Every profiling session is trying to answer one or more of these:\n\n' +
            '1. **Where is it slow?** — Which function, module, or system call is consuming the most time?\n' +
            '2. **Why is it slow?** — Is it CPU-bound computation, memory allocation churn, blocking I/O, or lock contention?\n' +
            '3. **How do I fix it?** — Now that you know where and why, what change will have the highest impact?\n\n' +
            'A good profiler gives you data for questions 1 and 2. Question 3 is still on you.',
        },
        {
          type: 'text',
          content:
            '## Types of Profiling\n\n' +
            '| Type | What it measures | Example question |\n' +
            '|------|-----------------|------------------|\n' +
            '| **CPU** | Time spent executing instructions | "Which function burns the most cycles?" |\n' +
            '| **Memory** | Allocations, heap size, leaks | "Why does RSS grow over time?" |\n' +
            '| **I/O** | Disk reads/writes, network calls | "Why does startup take 3 seconds?" |\n' +
            '| **Energy** | CPU/GPU/radio power draw | "Why does my app drain the battery?" |\n\n' +
            'Apple Instruments supports all four. Most web profilers focus on CPU and memory. ' +
            'Energy profiling is almost exclusively a mobile concern — and it is one of the things that makes Instruments unique.',
        },
        {
          type: 'text',
          content:
            '## The Measurement Hierarchy\n\n' +
            'Profiling data comes in layers of increasing richness:\n\n' +
            '- **Counters** — A single number over time. "CPU usage is 85%." Cheap to collect, limited in detail.\n' +
            '- **Events** — Discrete timestamped occurrences. "malloc() was called at T=42ms." More detail, more overhead.\n' +
            '- **Traces** — Sequences of events with duration. "parseJSON() started at T=42ms and ended at T=47ms." Shows causality.\n' +
            '- **Profiles** — Aggregated traces and samples with statistical summaries. "parseJSON() accounts for 23% of total CPU time across 1,200 samples." This is what you actually analyze.',
        },
        {
          type: 'mermaid',
          content:
            'graph LR\n' +
            '    A["Instrument"] --> B["Record"]\n' +
            '    B --> C["Analyze"]\n' +
            '    C --> D["Optimize"]\n' +
            '    D --> E["Verify"]\n' +
            '    E -->|"regression?"| A',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'The workflow above is a loop, not a line. After you optimize, you profile again to verify the improvement — and to make sure you did not introduce a new bottleneck. This is called **regression profiling** and it is a core practice at Apple.',
        },
        {
          type: 'text',
          content:
            '## Why This Matters for You\n\n' +
            'On the Instruments team, you will be building the tools that other developers use to answer these three questions. ' +
            'Understanding what profiling is — at a conceptual level, before any specific tool — gives you the vocabulary and mental model to evaluate design decisions in the profiler itself.',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 2 — Sampling vs Tracing
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-2',
      title: 'Sampling vs Tracing',
      moduleId: 'mod-2',
      order: 2,
      content: [
        {
          type: 'text',
          content:
            '# Sampling vs Tracing\n\n' +
            'There are two fundamentally different strategies for collecting profiling data. Every profiler you will ever encounter uses one or both of them.',
        },
        {
          type: 'text',
          content:
            '## Sampling\n\n' +
            'A **sampling profiler** periodically interrupts the target process (typically via a timer signal or hardware PMU interrupt), captures the current call stack of each thread, and resumes execution. ' +
            'It does this hundreds or thousands of times per second.\n\n' +
            'The result is statistical: if `parseJSON()` appears in 230 out of 1,000 samples, it accounts for roughly 23% of CPU time. ' +
            'You never recorded `parseJSON()` being called — you just caught it on the stack often enough to know it matters.\n\n' +
            '**Key properties:**\n' +
            '- Low overhead: typically 1-5% CPU impact\n' +
            '- No code changes required — works on any running process\n' +
            '- Statistical accuracy improves with more samples\n' +
            '- Cannot tell you exact call counts or precise durations',
        },
        {
          type: 'text',
          content:
            '## Tracing\n\n' +
            'A **tracing profiler** instruments every event you care about — function entry/exit, memory allocation, system call — and records each one with a precise timestamp.\n\n' +
            'The result is deterministic: you know exactly which functions were called, in what order, how many times, and how long each invocation took.\n\n' +
            '**Key properties:**\n' +
            '- High overhead: 10-50%+ CPU impact (sometimes much more)\n' +
            '- Often requires recompilation or code injection\n' +
            '- Produces exact data — no statistical uncertainty\n' +
            '- Generates large volumes of data that can be expensive to store and analyze',
        },
        {
          type: 'mermaid',
          content:
            'gantt\n' +
            '    title Sampling vs Tracing Timeline\n' +
            '    dateFormat X\n' +
            '    axisFormat %s\n' +
            '    section Actual Execution\n' +
            '        funcA runs           :a1, 0, 3\n' +
            '        funcB runs           :a2, 3, 7\n' +
            '        funcA runs again     :a3, 7, 10\n' +
            '    section Sampling at 2Hz\n' +
            '        sample 1 catches funcA  :milestone, m1, 1, 0\n' +
            '        sample 2 catches funcB  :milestone, m2, 5, 0\n' +
            '        sample 3 catches funcA  :milestone, m3, 9, 0\n' +
            '    section Tracing\n' +
            '        funcA entry+exit     :t1, 0, 3\n' +
            '        funcB entry+exit     :t2, 3, 7\n' +
            '        funcA entry+exit     :t3, 7, 10',
        },
        {
          type: 'text',
          content:
            '## The Aliasing Problem\n\n' +
            'Sampling has a subtle failure mode. If a function executes on a regular cycle that happens to align with (or fall between) the sampling interval, the profiler may consistently miss it — or consistently over-count it.\n\n' +
            'Imagine a function that runs for 0.4ms every 1ms, and your sampling interval is exactly 1ms. ' +
            'Depending on phase alignment, the sampler might catch it every time (making it look like 100% of CPU) or never catch it (making it invisible).\n\n' +
            'This is the same phenomenon as **aliasing** in signal processing. The solution is the same too: sample at a high enough frequency relative to the events you care about, and ideally add a small random jitter to the sampling interval.',
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'Instruments\' Time Profiler defaults to 1kHz (one sample per millisecond). Functions that execute in under ~100 microseconds may be underrepresented. If you suspect aliasing, increase the sample rate or switch to tracing.',
        },
        {
          type: 'text',
          content:
            '## When to Use Which\n\n' +
            '**Use sampling** when you want a broad overview: "Where is the app spending time?" This is your first move in almost every investigation.\n\n' +
            '**Use tracing** when you need precise answers: "Exactly how many times was this function called?" or "What is the exact sequence of events that led to this 16ms frame drop?"',
        },
        {
          type: 'comparison-table',
          headers: ['Dimension', 'Sampling', 'Tracing'],
          rows: [
            ['Overhead', '1-5%', '10-50%+'],
            ['Accuracy', 'Statistical (improves with more samples)', 'Exact'],
            ['Completeness', 'May miss short-lived functions', 'Captures everything instrumented'],
            ['Data volume', 'Small (stack snapshots)', 'Large (every event)'],
            ['Code changes', 'None required', 'Often requires instrumentation'],
            ['Best for', '"Where is time spent?"', '"What exactly happened?"'],
          ],
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'In practice, you almost always start with sampling and then selectively add tracing for the hot paths you identified. Instruments supports both in the same recording session — Time Profiler (sampling) alongside os_signpost (tracing).',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 3 — Call Stacks & Stack Walking
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-3',
      title: 'Call Stacks & Stack Walking',
      moduleId: 'mod-2',
      order: 3,
      content: [
        {
          type: 'text',
          content:
            '# Call Stacks & Stack Walking\n\n' +
            'Every sample a profiler takes is fundamentally a **call stack snapshot**: a list of return addresses representing the chain of function calls that led to the current point of execution. ' +
            'But how does a profiler actually read a call stack from a paused thread? That process is called **stack walking** (or stack unwinding), and it is harder than it sounds.',
        },
        {
          type: 'text',
          content:
            '## Frame Pointer Based Walking\n\n' +
            'The classic approach. When a function is called, it pushes the caller\'s frame pointer onto the stack and sets its own frame pointer to the current stack pointer. ' +
            'This creates a **linked list of stack frames** — each frame points to the previous one.\n\n' +
            'To walk the stack, you:\n' +
            '1. Read the current frame pointer register (e.g., `rbp` on x86-64, `x29` on ARM64)\n' +
            '2. The saved return address is at a known offset from the frame pointer\n' +
            '3. The previous frame pointer is stored at the frame pointer itself\n' +
            '4. Follow the chain until you hit the bottom of the stack (a null or sentinel frame pointer)',
        },
        {
          type: 'mermaid',
          content:
            'graph TB\n' +
            '    subgraph "Stack Memory (grows downward)"\n' +
            '        direction TB\n' +
            '        F3_FP["Frame 3: main()\\nFP → saved FP = NULL\\nReturn addr = _start+0x10"]\n' +
            '        F2_FP["Frame 2: processData()\\nFP → saved FP = Frame 3\\nReturn addr = main+0x42"]\n' +
            '        F1_FP["Frame 1: parseJSON()\\nFP → saved FP = Frame 2\\nReturn addr = processData+0x1a"]\n' +
            '        F0_FP["Current Frame: readToken()\\nFP register points here\\nReturn addr = parseJSON+0x38"]\n' +
            '    end\n' +
            '    F0_FP -->|"saved FP"| F1_FP\n' +
            '    F1_FP -->|"saved FP"| F2_FP\n' +
            '    F2_FP -->|"saved FP"| F3_FP',
        },
        {
          type: 'text',
          content:
            '**The problem:** Modern compilers (especially with optimizations enabled) often omit frame pointers to free up a register. ' +
            'On x86-64, `-fomit-frame-pointer` has been the default in GCC and Clang for years. ' +
            'Without frame pointers, the linked list is broken and this walking strategy fails.\n\n' +
            'On Apple platforms, ARM64 (Apple Silicon and all modern iPhones) **requires frame pointers by ABI convention**, so frame-pointer-based walking is reliable. ' +
            'This is one of the reasons Instruments\' stack walking is fast and accurate on Apple hardware.',
        },
        {
          type: 'text',
          content:
            '## DWARF Unwinding\n\n' +
            'When frame pointers are absent, the profiler falls back to **DWARF unwind information** — metadata embedded in the binary (or in a separate `.dSYM` bundle) that describes how to restore the previous stack frame from any instruction address.\n\n' +
            'DWARF unwind tables are essentially a program: "at instruction offset 0x10, the return address is at `RSP+8` and the previous frame pointer is at `RSP+0`." The profiler interprets this table for each frame to walk the stack.\n\n' +
            '**Tradeoffs:**\n' +
            '- More complex and slower than frame pointer walking\n' +
            '- Works even when frame pointers are omitted\n' +
            '- Requires debug info to be available (which may be stripped in release builds)',
        },
        {
          type: 'code',
          language: 'c',
          content:
            '// Pseudocode: frame-pointer-based stack walk\n' +
            'void walk_stack(void **frame_pointer) {\n' +
            '    while (frame_pointer != NULL) {\n' +
            '        void *return_addr = *(frame_pointer + 1);  // return address\n' +
            '        void *prev_fp     = *frame_pointer;        // previous frame pointer\n' +
            '\n' +
            '        record_sample(return_addr);  // save this address\n' +
            '        frame_pointer = prev_fp;     // walk up one frame\n' +
            '    }\n' +
            '}',
        },
        {
          type: 'text',
          content:
            '## Symbolication\n\n' +
            'Stack walking gives you raw memory addresses: `0x100003a40`, `0x100003b1c`, `0x100001e08`. ' +
            'These are meaningless to a human. **Symbolication** is the process of mapping those addresses back to function names, file paths, and line numbers.\n\n' +
            'This requires **debug symbols** — a table that maps address ranges to symbol names. On Apple platforms, these live in `.dSYM` bundles (generated at build time). On Linux, they are in the ELF binary itself (unless stripped) or in separate `.debug` files.\n\n' +
            'The symbolication pipeline:\n' +
            '1. Raw address: `0x100003a40`\n' +
            '2. Look up in symbol table: `parseJSON` at `0x100003a00` (offset +0x40)\n' +
            '3. Look up in DWARF line table: `Parser.swift:142`\n' +
            '4. Final result: `parseJSON() at Parser.swift:142`',
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'Without debug symbols, profiling data is almost useless. A flame graph full of hex addresses tells you nothing. Always keep dSYMs for any build you intend to profile — Instruments will refuse to symbolicate without them.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Chrome DevTools does not need separate symbol files because JavaScript is interpreted — the engine already knows function names and source locations. This is why web profiling "just works" without a symbolication step.',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 4 — Flame Charts
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-4',
      title: 'Flame Charts',
      moduleId: 'mod-2',
      order: 4,
      content: [
        {
          type: 'text',
          content:
            '# Flame Charts\n\n' +
            'A flame chart is a visualization of profiling data where:\n\n' +
            '- **X axis** = time (left to right)\n' +
            '- **Y axis** = call stack depth (bottom to top — deepest frames at the top)\n' +
            '- **Width** of each bar = how long that function was on the stack\n\n' +
            'Every horizontal bar represents a single invocation of a function. A wide bar means the function was running (or waiting) for a long time. A narrow bar means it was brief.',
        },
        {
          type: 'text',
          content:
            '## How to Read a Flame Chart\n\n' +
            '**Start at the bottom.** The bottom row is always your entry point (`main()`, or the browser\'s event loop). Each row above it is a function called by the function below.\n\n' +
            '**Look for wide bars.** A function that spans 200ms of the 500ms recording is your primary suspect. But be precise: a function is only "expensive" if it is doing work itself — not just because it calls other expensive functions. ' +
            'The **self time** (the width that is NOT covered by children) is what matters.\n\n' +
            '**Look for tall stacks.** Deep call stacks mean deep recursion or heavily layered abstractions. Neither is inherently bad, but both make it harder to find the actual work.',
        },
        {
          type: 'mermaid',
          content:
            'block-beta\n' +
            '    columns 12\n' +
            '    space:12\n' +
            '    A["main()                                      "]:12\n' +
            '    B["handleRequest()               "]:8 space:1 G["logMetrics()"]:3\n' +
            '    C["parseJSON()    "]:5 D["validate()"]:3 space:1 H["write()"]:3\n' +
            '    E["readToken()"]:3 F["alloc()"]:2 space:7',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'The diagram above is simplified. In a real flame chart, every bar has precise pixel-width proportional to its duration. The key insight: `handleRequest()` is wide but most of its time is spent in `parseJSON()` — so `parseJSON()` is the real target for optimization, not `handleRequest()`.',
        },
        {
          type: 'text',
          content:
            '## How Flame Charts Are Built from Samples\n\n' +
            'A sampling profiler collects thousands of call stack snapshots. To build a flame chart:\n\n' +
            '1. Lay out each sample on the time axis at its timestamp\n' +
            '2. For each sample, draw the stack frames as stacked bars\n' +
            '3. Merge consecutive samples where the same function is at the same depth into a single continuous bar\n\n' +
            'The result is a dense, continuous visualization even though the underlying data is discrete samples. ' +
            'Functions that appear in many consecutive samples produce wide bars. Functions that appear in only one or two samples produce thin slivers.',
        },
        {
          type: 'text',
          content:
            '## Interactive Exploration\n\n' +
            'Flame charts are designed to be explored, not just viewed:\n\n' +
            '- **Zoom** into a time range to see sub-millisecond detail\n' +
            '- **Hover** over a bar to see the function name, self time, and total time\n' +
            '- **Click** a bar to select it and see its full call stack\n' +
            '- **Filter** by thread to focus on the main thread, a worker, or a background queue\n\n' +
            'If you have used the **Performance tab** in Chrome DevTools, the "Main" section in the bottom pane IS a flame chart. ' +
            'You have already been reading flame charts — now you know the underlying data model.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'In Chrome DevTools, the flame chart grows downward (callees below callers). In Instruments and many other tools, it grows upward. The data is identical — just inverted. Do not let the orientation confuse you.',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 5 — Flame Graphs
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-5',
      title: 'Flame Graphs',
      moduleId: 'mod-2',
      order: 5,
      content: [
        {
          type: 'text',
          content:
            '# Flame Graphs\n\n' +
            'Flame graphs were invented by **Brendan Gregg** in 2011 while he was a performance engineer at Joyent (later Netflix). ' +
            'They solve a specific problem: flame charts show you *when* things happened, but they make it hard to see *what the overall bottleneck is* across an entire recording.\n\n' +
            'A flame graph **aggregates** all samples by merging identical stack frames, regardless of when they occurred.',
        },
        {
          type: 'text',
          content:
            '## How Flame Graphs Differ from Flame Charts\n\n' +
            'The critical difference:\n\n' +
            '- In a **flame chart**, the X axis is **time**. Two calls to `parseJSON()` at different times appear as two separate bars.\n' +
            '- In a **flame graph**, the X axis is **percentage of total samples** (or alphabetical order). Two calls to `parseJSON()` from the same call path are **merged into one bar** whose width represents their combined sample count.\n\n' +
            'The X axis ordering in a flame graph is not meaningful — it is typically alphabetical to make it easier to find specific functions. Only the **width** matters.',
        },
        {
          type: 'mermaid',
          content:
            'graph TD\n' +
            '    subgraph "Sampled Stacks (4 samples)"\n' +
            '        S1["Sample 1:\\nmain → parse → read"]\n' +
            '        S2["Sample 2:\\nmain → parse → alloc"]\n' +
            '        S3["Sample 3:\\nmain → render"]\n' +
            '        S4["Sample 4:\\nmain → parse → read"]\n' +
            '    end\n' +
            '    subgraph "Flame Graph (merged)"\n' +
            '        M["main: 4/4 = 100%"]\n' +
            '        P["parse: 3/4 = 75%"]\n' +
            '        R["render: 1/4 = 25%"]\n' +
            '        RD["read: 2/4 = 50%"]\n' +
            '        AL["alloc: 1/4 = 25%"]\n' +
            '        M --> P\n' +
            '        M --> R\n' +
            '        P --> RD\n' +
            '        P --> AL\n' +
            '    end',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'In the diagram above, `parse` appeared in 3 of 4 samples. In a flame graph, it would be rendered as a bar that is 75% as wide as the root `main` bar. The `read` and `alloc` children of `parse` split its width proportionally.',
        },
        {
          type: 'comparison-table',
          headers: ['Dimension', 'Flame Chart', 'Flame Graph'],
          rows: [
            ['X axis', 'Time', 'Alphabetical / percentage'],
            ['Duplicate calls', 'Shown separately at their timestamps', 'Merged into one bar'],
            ['Answers', '"What happened at time T?"', '"What is the overall bottleneck?"'],
            ['Data loss', 'None — preserves temporal order', 'Temporal order is discarded'],
            ['Best for', 'Investigating a specific hitch or spike', 'Finding the #1 optimization target'],
            ['Used in', 'Chrome DevTools, Instruments detail view', 'Brendan Gregg\'s tools, Speedscope, Instruments summary view'],
          ],
        },
        {
          type: 'text',
          content:
            '## Differential Flame Graphs\n\n' +
            'One of the most powerful uses of flame graphs is **comparing two profiles**. A differential flame graph takes a "before" and "after" recording, merges both, and color-codes the differences:\n\n' +
            '- **Red** = this function got slower (more samples in "after")\n' +
            '- **Blue** = this function got faster (fewer samples in "after")\n' +
            '- **Neutral** = no significant change\n\n' +
            'This is invaluable for regression hunting. If your app got 15% slower after a code change, a differential flame graph shows you exactly which functions account for the difference.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'When someone asks you to "profile a performance regression," the workflow is: record a baseline profile on the known-good version, record another on the regressed version, and generate a differential flame graph. This is faster and more precise than staring at two flame graphs side by side.',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 6 — The Multi-Track Timeline
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-6',
      title: 'The Multi-Track Timeline',
      moduleId: 'mod-2',
      order: 6,
      content: [
        {
          type: 'text',
          content:
            '# The Multi-Track Timeline\n\n' +
            'Profiling a real application means looking at many data streams simultaneously: CPU usage, memory allocations, network requests, disk I/O, GPU utilization, and UI frame delivery — all on a shared time axis.\n\n' +
            'The **multi-track timeline** is the visualization that makes this possible. It is the core UI pattern in Apple Instruments, Google Perfetto, and Android Studio Profiler.',
        },
        {
          type: 'text',
          content:
            '## Why Correlation Matters\n\n' +
            'Individual metrics lie by omission. A CPU spike means nothing by itself. But a CPU spike + a memory spike + a UI hitch *at the exact same timestamp* tells a story: the app allocated a large data structure, triggering heavy computation, which blocked the main thread long enough to drop frames.\n\n' +
            'The multi-track timeline lets you see these correlations instantly because every track shares the same X axis (time). Vertical alignment IS the insight.',
        },
        {
          type: 'mermaid',
          content:
            'graph TD\n' +
            '    subgraph "Multi-Track Timeline"\n' +
            '        direction LR\n' +
            '        subgraph "CPU Track"\n' +
            '            C1["|||||||||| 85%"]\n' +
            '        end\n' +
            '        subgraph "Memory Track"\n' +
            '            M1["======= 240MB peak"]\n' +
            '        end\n' +
            '        subgraph "Network Track"\n' +
            '            N1["--- GET /api/data ---"]\n' +
            '        end\n' +
            '        subgraph "UI Frames Track"\n' +
            '            U1["16ms | 16ms | 48ms HITCH | 16ms"]\n' +
            '        end\n' +
            '    end',
        },
        {
          type: 'text',
          content:
            '## Track Types\n\n' +
            'Different kinds of data call for different visual representations:\n\n' +
            '- **Counters (line graphs)** — Continuous numeric values over time. CPU %, memory RSS, frame rate. Rendered as a filled area chart or line chart.\n' +
            '- **States (colored bars)** — Mutually exclusive states over time. Thread states (Running / Blocked / Waiting), app lifecycle (Active / Background / Suspended). Rendered as colored horizontal bars.\n' +
            '- **Events (point markers)** — Discrete occurrences. Log messages, signpost events, exceptions. Rendered as vertical ticks or dots on the timeline.\n' +
            '- **Intervals (ranges)** — Operations with a start and end time. Network requests, os_signpost intervals, GC pauses. Rendered as horizontal bars with width = duration.',
        },
        {
          type: 'text',
          content:
            '## The Inspection Range\n\n' +
            'The most important interaction pattern in a multi-track timeline: **select a time window, and every track filters to it.**\n\n' +
            'You see a CPU spike at T=3.2s. You drag to select T=3.0s to T=3.5s. Now:\n' +
            '- The CPU track zooms to show the spike in detail\n' +
            '- The memory track shows allocations during that 500ms window\n' +
            '- The flame chart below filters to only show stacks sampled during that window\n' +
            '- The call tree aggregates only those samples\n\n' +
            'This is how you go from "something happened around 3 seconds" to "at T=3.21s, `layoutSubviews()` triggered a 47ms synchronous JSON parse on the main thread." ' +
            'The inspection range is your scalpel.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Instruments calls this the "inspection range" or "analysis range." Perfetto calls it "time selection." Chrome DevTools does it implicitly when you zoom into the timeline. The concept is universal — only the terminology varies.',
        },
        {
          type: 'text',
          content:
            '## Why This Matters for Our Project\n\n' +
            'The SDK you will help build at Apple generates the data that populates these tracks. ' +
            'Every design decision in the SDK — what to record, what to drop, how to compress, when to flush — directly affects the quality of the timeline the developer sees in Instruments. ' +
            'Understanding the multi-track timeline as a *consumer* is the first step to understanding the engineering constraints of the *producer*.',
        },
      ],
    },

    // ──────────────────────────────────────────────
    // Lesson 7 — Observer Effect & Overhead
    // ──────────────────────────────────────────────
    {
      id: 'mod-2-lesson-7',
      title: 'Observer Effect & Overhead',
      moduleId: 'mod-2',
      order: 7,
      content: [
        {
          type: 'text',
          content:
            '# Observer Effect & Overhead\n\n' +
            'Every profiler changes the behavior of the program it measures. This is the **observer effect** — a concept borrowed from physics, where measuring a particle\'s position changes its momentum.\n\n' +
            'In profiling, the observer effect means: the performance data you collect is never a perfect picture of the uninstrumented program. The act of collecting data consumes CPU cycles, allocates memory, and generates I/O that would not otherwise exist.',
        },
        {
          type: 'text',
          content:
            '## Heisenbugs\n\n' +
            'A **heisenbug** is a bug that disappears (or changes behavior) when you try to observe it. Classic examples:\n\n' +
            '- A race condition that only manifests at full speed — adding logging slows execution enough to change thread interleaving\n' +
            '- A performance cliff that occurs at >60fps — but profiling overhead drops frame rate to 55fps, hiding the cliff\n' +
            '- A memory corruption bug triggered by tight allocation patterns — but the profiler\'s own allocations shift heap layout enough to avoid the corruption\n\n' +
            'You cannot eliminate heisenbugs, but you can minimize them by minimizing profiling overhead.',
        },
        {
          type: 'text',
          content:
            '## Sources of Overhead\n\n' +
            'Profiling overhead comes from three places:\n\n' +
            '**1. CPU overhead** — The profiler needs CPU cycles to:\n' +
            '- Pause and resume threads (for sampling)\n' +
            '- Walk call stacks\n' +
            '- Execute instrumented code paths (for tracing)\n' +
            '- Symbolicate addresses\n\n' +
            '**2. Memory overhead** — The profiler needs memory to:\n' +
            '- Store collected samples and events\n' +
            '- Buffer data before writing to disk or streaming to a host\n' +
            '- Maintain internal data structures (hash maps, ring buffers)\n\n' +
            '**3. I/O overhead** — The profiler needs I/O bandwidth to:\n' +
            '- Write trace data to disk\n' +
            '- Stream data to a host machine over USB or network\n' +
            '- Read debug symbols for symbolication',
        },
        {
          type: 'mermaid',
          content:
            'pie title Overhead Budget for a Well-Designed Profiler\n' +
            '    "App execution" : 95\n' +
            '    "Stack walking" : 2\n' +
            '    "Data buffering" : 1.5\n' +
            '    "I/O streaming" : 1\n' +
            '    "Metadata bookkeeping" : 0.5',
        },
        {
          type: 'text',
          content:
            '## The 5% Rule\n\n' +
            'A widely accepted guideline: **profiling overhead should stay under 5% of the profiled app\'s resources.** Beyond that, you are no longer measuring the real app — you are measuring the app-plus-profiler system, and the results become unreliable.\n\n' +
            'This is not a hard limit. Some investigations require higher overhead (detailed allocation tracing, for example). But 5% is the threshold where most developers stop noticing the profiler and start trusting the data.',
        },
        {
          type: 'text',
          content:
            '## Strategies to Minimize Overhead\n\n' +
            '**Ring buffers** — Instead of growing a buffer forever, use a fixed-size ring buffer that overwrites the oldest data. This caps memory usage and avoids allocation spikes. When the profiler stops, you have the most recent N seconds of data.\n\n' +
            '**Deferred processing** — Record raw data (addresses, timestamps) during collection and do expensive work (symbolication, aggregation) later, after the recording stops. This moves CPU overhead out of the measurement window.\n\n' +
            '**Adaptive sampling** — Reduce the sampling rate when the system is under heavy load (which is exactly when you want the profiler to interfere least).\n\n' +
            '**Sampling over tracing** — When in doubt, sample. The overhead difference (1-5% vs 10-50%) is often the difference between usable data and distorted data.',
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'A profiling SDK that exceeds 5% overhead on an iOS device will get flagged in Apple\'s internal performance reviews. Battery life and thermal pressure are first-class concerns. The SDK must be lightweight even when actively recording.',
        },
        {
          type: 'text',
          content:
            '## Why This Matters for Your Internship\n\n' +
            'The profiling SDK runs **inside the customer\'s app**, on the customer\'s device, while the customer\'s user is using it. ' +
            'Every byte of memory and every microsecond of CPU the SDK consumes is stolen from the app.\n\n' +
            'This is the central engineering tension of profiling tools: you need enough data to be useful, but you need to collect it cheaply enough to be invisible. ' +
            'Every design decision in the SDK — buffer sizes, sampling rates, data formats, compression strategies — is a tradeoff between data quality and overhead. ' +
            'The lessons in this module give you the vocabulary to reason about those tradeoffs.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'When reviewing a profiling SDK design, always ask: "What happens if we double the sampling rate?" and "What happens if the app is already at 95% CPU?" If the answer is "the overhead doubles too" or "the SDK makes it worse," the design needs work.',
        },
      ],
    },
  ],

  // ──────────────────────────────────────────────
  // Quiz — 10 questions, 250 XP
  // ──────────────────────────────────────────────
  quiz: {
    moduleId: 'mod-2',
    questions: [
      {
        id: 'mod-2-q-1',
        question:
          'A sampling profiler running at 1kHz might miss a function that runs for 0.5ms and completes between samples. What is this limitation called?',
        options: [
          'Observer effect',
          'Aliasing / sampling bias',
          'Stack corruption',
          'Symbolication failure',
        ],
        correctIndex: 1,
        explanation:
          'This is the aliasing problem (also called sampling bias). If a function\'s execution consistently falls between sample points, the profiler never catches it on the stack. It is the same phenomenon as aliasing in signal processing — the sampling frequency is too low relative to the event frequency. The fix is a higher sample rate or adding random jitter to the interval.',
      },
      {
        id: 'mod-2-q-2',
        question:
          'Why do flame charts use the X axis for time while flame graphs do not?',
        options: [
          'Flame graphs cannot represent time data',
          'Flame charts are newer and more advanced',
          'Flame graphs merge identical stacks across time to show aggregate bottlenecks, making temporal order irrelevant',
          'Flame graphs use the Y axis for time instead',
        ],
        correctIndex: 2,
        explanation:
          'Flame graphs aggregate all samples by merging identical call stacks, regardless of when they occurred. The X axis represents the proportion of total samples (or is sorted alphabetically), not time. This makes temporal information invisible but reveals the overall hottest code paths — which is exactly the point.',
      },
      {
        id: 'mod-2-q-3',
        question:
          'What does symbolication do, and why is it necessary?',
        options: [
          'It compresses profiling data for storage',
          'It converts raw memory addresses into human-readable function names, file paths, and line numbers using debug symbols',
          'It encrypts profiling data so only authorized tools can read it',
          'It converts high-level function names into memory addresses for the profiler to use',
        ],
        correctIndex: 1,
        explanation:
          'Stack walking produces raw instruction addresses (e.g., 0x100003a40). Symbolication maps these to function names like "parseJSON() at Parser.swift:142" using debug symbol tables (dSYM bundles on Apple platforms, DWARF info on Linux). Without symbolication, profiling data is a wall of hex — technically accurate but practically useless.',
      },
      {
        id: 'mod-2-q-4',
        question:
          'A profiler introduces 30% CPU overhead during a recording session. What type of profiling is it most likely using?',
        options: [
          'Sampling at 1kHz',
          'Energy profiling',
          'Tracing / instrumentation',
          'Counter-based profiling',
        ],
        correctIndex: 2,
        explanation:
          'Sampling profilers typically introduce 1-5% overhead. 30% overhead strongly suggests tracing or instrumentation, where every function call or event is recorded. This level of overhead is common when tracing all memory allocations, all function entries/exits, or all system calls.',
      },
      {
        id: 'mod-2-q-5',
        question:
          'In a multi-track timeline, you see a CPU spike and a UI hitch occurring at the same timestamp. What is the most likely relationship?',
        options: [
          'Coincidence — CPU and UI tracks are independent',
          'The CPU spike caused the UI hitch by blocking the main thread during an expensive computation',
          'The UI hitch caused the CPU spike',
          'Both were caused by a network timeout',
        ],
        correctIndex: 1,
        explanation:
          'When a CPU spike and a UI hitch are temporally correlated, the most common cause is expensive work running on the main thread. The computation monopolizes the main thread\'s CPU time, preventing the UI framework from delivering frames on time. This is the textbook pattern that multi-track timelines are designed to reveal.',
      },
      {
        id: 'mod-2-q-6',
        question:
          'On ARM64 (Apple Silicon), frame-pointer-based stack walking is reliable because:',
        options: [
          'ARM64 has more registers, making stack walking faster',
          'The ARM64 ABI on Apple platforms requires frame pointers, so the linked-list chain is always intact',
          'DWARF unwind information is always embedded in ARM64 binaries',
          'Apple Silicon hardware has dedicated stack-walking circuitry',
        ],
        correctIndex: 1,
        explanation:
          'The ARM64 calling convention on Apple platforms mandates that the frame pointer register (x29) is always maintained. This means every stack frame contains a valid pointer to the previous frame, creating a reliable linked list that the profiler can traverse. On x86-64, compilers often omit frame pointers for optimization, breaking this chain.',
      },
      {
        id: 'mod-2-q-7',
        question:
          'A bug disappears when you attach a profiler. What is this called, and what causes it?',
        options: [
          'A heisenbug — the profiler\'s overhead changes timing, memory layout, or thread scheduling enough to mask the original bug',
          'A sampling artifact — the profiler is not recording fast enough to catch the bug',
          'A symbolication error — the profiler is showing the wrong function names',
          'A regression bug — the profiler\'s code patches fix the original issue',
        ],
        correctIndex: 0,
        explanation:
          'A heisenbug (named after Heisenberg\'s uncertainty principle) is a bug that changes behavior when you observe it. The profiler\'s overhead alters the execution environment — adding latency, shifting heap layout, changing thread interleaving — which can make race conditions, timing-dependent bugs, or memory corruption issues disappear or change behavior.',
      },
      {
        id: 'mod-2-q-8',
        question:
          'Why do profilers use ring buffers instead of unbounded buffers?',
        options: [
          'Ring buffers are faster to read from',
          'Ring buffers cap memory usage at a fixed size and avoid allocation spikes, keeping profiler overhead constant and predictable',
          'Ring buffers produce better flame graphs',
          'Ring buffers are required by the operating system kernel',
        ],
        correctIndex: 1,
        explanation:
          'A ring buffer has a fixed size and overwrites the oldest data when full. This guarantees that the profiler\'s memory usage never grows beyond its budget — critical when running inside a customer\'s app. An unbounded buffer could exhaust memory during a long recording or on a memory-constrained device, potentially crashing the very app you are trying to profile.',
      },
      {
        id: 'mod-2-q-9',
        question:
          'You need to determine exactly how many times malloc() was called during a 2-second window. Which profiling approach should you use?',
        options: [
          'Sampling at 10kHz',
          'Flame graph analysis',
          'Tracing with instrumentation on malloc()',
          'Counter-based CPU profiling',
        ],
        correctIndex: 2,
        explanation:
          'Sampling can estimate how much time is spent in malloc(), but it cannot give you an exact call count — only a statistical approximation. To know the exact number of calls, you need tracing: instrument malloc() to record every entry, giving you a deterministic count. The overhead will be higher, but precision is what this question demands.',
      },
      {
        id: 'mod-2-q-10',
        question:
          'A profiler uses "deferred processing" as an overhead-reduction strategy. What does this mean?',
        options: [
          'The profiler delays starting the recording until the app is idle',
          'The profiler records raw data (addresses, timestamps) during collection and performs expensive work like symbolication and aggregation after the recording stops',
          'The profiler sends data to a remote server for processing',
          'The profiler reduces its sampling rate during high CPU load',
        ],
        correctIndex: 1,
        explanation:
          'Deferred processing means collecting minimal raw data during the recording (just addresses and timestamps) and postponing CPU-intensive work like symbolication, stack merging, and statistical aggregation until after the recording ends. This keeps the profiler\'s impact low during the measurement window, when accuracy matters most. The developer waits a few seconds after stopping the recording, but the data is more faithful.',
      },
    ],
    passingScore: 70,
    xpReward: 250,
  },
};

export default module2;
