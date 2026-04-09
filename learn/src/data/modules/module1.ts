import type { Module } from '../types';

const module1: Module = {
  id: 'os-fundamentals',
  number: 1,
  title: 'OS Fundamentals',
  description:
    'Core operating system concepts every profiling engineer needs — processes, memory, scheduling, and the kernel boundary.',
  lessons: [
    // ─────────────────────────────────────────────
    // Lesson 1: Processes & Threads
    // ─────────────────────────────────────────────
    {
      id: 'processes-and-threads',
      title: 'Processes & Threads',
      moduleId: 'os-fundamentals',
      order: 1,
      content: [
        {
          type: 'text',
          content:
            'A **process** is an isolated running program. The OS gives each process its own virtual address space, a unique process ID (PID), a set of open file descriptors, and security credentials. Two processes cannot read each other\'s memory unless they explicitly set up shared memory.',
        },
        {
          type: 'text',
          content:
            'A **thread** is a unit of execution *within* a process. All threads in a process share the same heap and global data, but each thread has its own **stack** and **register state**. Creating a thread is cheaper than creating a process because there\'s no address space to duplicate.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Web dev analogy: A process is like a browser tab — isolated memory, crashes independently. A thread is like a Web Worker — runs concurrently inside the same origin, shares some resources, but has its own execution context.',
        },
        {
          type: 'mermaid',
          content: `flowchart TD
    subgraph Process["Process (PID 4821)"]
        direction TB
        subgraph Shared["Shared Memory"]
            Heap["Heap\\n(dynamic allocations)"]
            Code["Code Segment\\n(.text)"]
            Data["Global Data\\n(.data / .bss)"]
        end
        subgraph T1["Thread 1 (main)"]
            S1["Stack 1"]
            R1["Registers 1"]
        end
        subgraph T2["Thread 2"]
            S2["Stack 2"]
            R2["Registers 2"]
        end
        subgraph T3["Thread 3"]
            S3["Stack 3"]
            R3["Registers 3"]
        end
    end
    T1 --- Shared
    T2 --- Shared
    T3 --- Shared`,
        },
        {
          type: 'text',
          content:
            'Every process has at least one thread — the **main thread**. On iOS, the main thread owns the UI run loop; blocking it causes visible hangs. Additional threads handle background work like networking, decoding, or computation.',
        },
        {
          type: 'comparison-table',
          headers: ['', 'Process', 'Thread'],
          rows: [
            ['Memory', 'Own address space', 'Shares process address space'],
            ['Creation cost', 'Expensive (copy page tables)', 'Cheap (allocate stack)'],
            ['Communication', 'IPC (pipes, sockets, shared memory)', 'Direct memory access (needs synchronization)'],
            ['Crash isolation', 'One crash doesn\'t kill others', 'One crash kills entire process'],
            ['Scheduling unit', 'Not directly scheduled', 'Scheduled onto CPU cores'],
          ],
        },
        {
          type: 'text',
          content:
            '**Concurrency** means multiple tasks make progress over a time period — they may interleave on a single core. **Parallelism** means tasks literally execute at the same instant on different cores. A single-core machine can be concurrent but never parallel.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    subgraph Concurrency["Concurrency (1 core)"]
        direction TB
        C1["T1 runs"] --> C2["T2 runs"] --> C3["T1 runs"] --> C4["T2 runs"]
    end
    subgraph Parallelism["Parallelism (2 cores)"]
        direction TB
        P1["Core 0: T1 runs"]
        P2["Core 1: T2 runs"]
    end`,
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Apple\'s Time Profiler samples every thread independently. It needs to know which thread is executing which function at each sample. Instruments groups samples by thread so you can see, for example, that the main thread is stuck in layout while a background thread is doing JSON parsing.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 2: The Call Stack
    // ─────────────────────────────────────────────
    {
      id: 'the-call-stack',
      title: 'The Call Stack',
      moduleId: 'os-fundamentals',
      order: 2,
      content: [
        {
          type: 'text',
          content:
            'When a function calls another function, the CPU needs to remember where to return. It pushes a **stack frame** onto the call stack. Each frame contains the return address, saved registers, function parameters, and local variables.',
        },
        {
          type: 'text',
          content:
            'Two registers govern the stack. The **stack pointer** (SP) points to the top of the stack — the most recently pushed data. The **frame pointer** (FP, also called base pointer / BP on x86) points to a fixed location in the current frame, making it easy to find local variables and the previous frame.',
        },
        {
          type: 'code',
          language: 'c',
          content: `#include <stdio.h>

void baz(int z) {
    int local_z = z * 3;       // Stack: [main] → [foo] → [bar] → [baz]
    printf("baz: %d\\n", local_z);
}

void bar(int y) {
    int local_y = y * 2;       // Stack: [main] → [foo] → [bar]
    baz(local_y);
}

void foo(int x) {
    int local_x = x + 1;      // Stack: [main] → [foo]
    bar(local_x);
}

int main() {
    foo(10);                   // Stack: [main]
    return 0;
}`,
        },
        {
          type: 'mermaid',
          content: `flowchart TB
    subgraph Stack["Call Stack (grows downward ↓)"]
        direction TB
        High["High addresses"]
        F1["main()\\nreturn addr: _start\\nlocals: —"]
        F2["foo(10)\\nreturn addr: main+0x1c\\nlocals: local_x = 11"]
        F3["bar(11)\\nreturn addr: foo+0x18\\nlocals: local_y = 22"]
        F4["baz(22)\\nreturn addr: bar+0x1c\\nlocals: local_z = 66"]
        Low["Low addresses"]
        High --> F1 --> F2 --> F3 --> F4 --> Low
    end
    SP["SP (stack pointer)"] -.-> F4
    FP["FP (frame pointer)"] -.-> F4`,
        },
        {
          type: 'text',
          content:
            'When `baz` returns, the CPU pops its frame: restores the saved registers, sets the instruction pointer to the return address (`bar+0x1c`), and adjusts the stack pointer. Execution continues in `bar` right after the call to `baz`.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'You already know this concept. JavaScript\'s "Maximum call stack size exceeded" error means too many frames were pushed (usually infinite recursion). The mechanics are identical — JS engines use the same stack frame model internally.',
        },
        {
          type: 'text',
          content:
            '**Stack walking** (also called "unwinding") is how a profiler captures a backtrace. Starting from the current frame pointer, it follows the chain of saved frame pointers backward through each frame, collecting the return address at each step. The result is the call stack you see in Instruments.',
        },
        {
          type: 'mermaid',
          content: `sequenceDiagram
    participant Profiler
    participant CPU
    participant Stack as Call Stack

    Profiler->>CPU: Interrupt (timer fires)
    CPU->>Profiler: Current PC + FP
    Profiler->>Stack: Read frame at FP
    Stack-->>Profiler: Return addr + prev FP
    Profiler->>Stack: Read frame at prev FP
    Stack-->>Profiler: Return addr + prev FP
    Profiler->>Stack: Read frame at prev FP
    Stack-->>Profiler: Return addr + prev FP (null → bottom)
    Note over Profiler: Backtrace: baz → bar → foo → main`,
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'Compilers can omit the frame pointer as an optimization (`-fomit-frame-pointer`), using the stack pointer instead. This makes stack walking harder — the profiler needs DWARF debug info or `.eh_frame` unwind tables to reconstruct the chain. Apple\'s tools handle this, but it\'s why debug builds profile more reliably.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 3: CPU Scheduling
    // ─────────────────────────────────────────────
    {
      id: 'cpu-scheduling',
      title: 'CPU Scheduling',
      moduleId: 'os-fundamentals',
      order: 3,
      content: [
        {
          type: 'text',
          content:
            'The OS scheduler decides which thread runs on which CPU core and for how long. Modern systems have far more threads than cores — macOS typically has hundreds of threads across dozens of processes sharing 8-12 cores.',
        },
        {
          type: 'text',
          content:
            'A **context switch** saves one thread\'s entire register state (general-purpose registers, stack pointer, program counter, floating-point registers) and restores another thread\'s saved state. This is expensive — typically 1-10 microseconds plus cache pollution.',
        },
        {
          type: 'mermaid',
          content: `sequenceDiagram
    participant T1 as Thread A
    participant OS as Scheduler
    participant T2 as Thread B
    participant Core as CPU Core

    T1->>Core: Running
    Note over Core: Timer interrupt (time slice expired)
    Core->>OS: Trap to kernel
    OS->>OS: Save Thread A registers
    OS->>OS: Select next thread (Thread B)
    OS->>OS: Restore Thread B registers
    OS->>T2: Resume
    T2->>Core: Running`,
        },
        {
          type: 'text',
          content:
            'The scheduler gives each thread a **time slice** (quantum) — a short window, typically 1-10 ms. When the quantum expires, a timer interrupt fires and the OS can **preempt** the thread: forcibly pause it and switch to another. The thread doesn\'t get a choice.',
        },
        {
          type: 'text',
          content:
            'Threads transition between states. A thread is **Running** when it\'s executing on a core, **Ready** (runnable) when it could run but no core is available, and **Blocked** (waiting) when it\'s waiting for I/O, a lock, or a signal.',
        },
        {
          type: 'mermaid',
          content: `stateDiagram-v2
    [*] --> Ready: Thread created
    Ready --> Running: Scheduler picks thread
    Running --> Ready: Preempted (time slice expired)
    Running --> Blocked: Waits for I/O, lock, or signal
    Blocked --> Ready: I/O complete or lock acquired
    Running --> [*]: Thread exits`,
        },
        {
          type: 'text',
          content:
            'Common scheduling policies:\n\n- **Round-robin**: threads take turns in a circular queue, each getting a fixed time slice. Simple and fair.\n- **Priority-based**: higher-priority threads run first. Starvation is possible if low-priority threads never get scheduled.\n- **Multilevel feedback queue**: combines both — threads start at high priority and drop if they use their full quantum (CPU-bound), or stay high if they block quickly (I/O-bound). macOS/XNU uses a variant of this.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    subgraph Core0["CPU Core 0"]
        direction LR
        C0T1["Thread A\\n0-4ms"] --> C0T2["Thread C\\n4-8ms"] --> C0T3["Thread A\\n8-12ms"]
    end
    subgraph Core1["CPU Core 1"]
        direction LR
        C1T1["Thread B\\n0-3ms"] --> C1W["Thread B\\nblocked (I/O)\\n3-9ms"] --> C1T2["Thread D\\n3-9ms"] --> C1T3["Thread B\\n9-12ms"]
    end`,
        },
        {
          type: 'text',
          content:
            '**Priority inversion** occurs when a high-priority thread waits for a lock held by a low-priority thread, but a medium-priority thread preempts the low-priority one — so the high-priority thread is effectively blocked by the medium one. The classic fix is **priority inheritance**: temporarily boost the lock holder\'s priority.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'On iOS, priority inversion is managed via Quality of Service (QoS) classes: userInteractive > userInitiated > utility > background. GCD and os_unfair_lock use priority inheritance automatically. Instruments\' System Trace shows exactly when priority inversion occurs.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Time Profiler records samples only when a thread is in the Running state. If a thread spends 80% of wall-clock time in Blocked state waiting for a lock, Time Profiler won\'t show that — you need System Trace to see wait times. Understanding thread states is essential for interpreting profiling data correctly.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 4: Virtual Memory
    // ─────────────────────────────────────────────
    {
      id: 'virtual-memory',
      title: 'Virtual Memory',
      moduleId: 'os-fundamentals',
      order: 4,
      content: [
        {
          type: 'text',
          content:
            'Every process sees a flat, private address space — its **virtual address space**. The hardware\'s Memory Management Unit (MMU) translates virtual addresses to physical RAM addresses on every memory access. This translation is invisible to the process.',
        },
        {
          type: 'text',
          content:
            'Memory is divided into **pages** — fixed-size blocks, typically 4 KB on x86 and 16 KB on Apple Silicon (ARM). The OS maintains a **page table** for each process, mapping virtual page numbers to physical frame numbers.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    subgraph Virtual["Virtual Address Space"]
        VP0["Page 0\\n0x0000"]
        VP1["Page 1\\n0x4000"]
        VP2["Page 2\\n0x8000"]
        VP3["Page 3\\n0xC000"]
    end
    subgraph PT["Page Table"]
        E0["0 → Frame 5"]
        E1["1 → Frame 2"]
        E2["2 → not mapped"]
        E3["3 → Frame 9"]
    end
    subgraph Physical["Physical RAM"]
        PF2["Frame 2"]
        PF5["Frame 5"]
        PF9["Frame 9"]
    end
    VP0 --> E0 --> PF5
    VP1 --> E1 --> PF2
    VP2 --> E2
    VP3 --> E3 --> PF9`,
        },
        {
          type: 'text',
          content:
            'A **page fault** occurs when a process accesses a virtual page that isn\'t currently in physical RAM. The MMU traps to the kernel, which either loads the page from disk (major fault) or sets up a new zero-filled page (minor fault). The process is suspended until the fault is resolved.',
        },
        {
          type: 'text',
          content:
            'The virtual address space of a typical process has a well-defined layout:',
        },
        {
          type: 'mermaid',
          content: `flowchart TB
    subgraph VAS["Virtual Address Space (high → low)"]
        direction TB
        Kernel["Kernel Space\\n(inaccessible from user mode)"]
        Stack["Stack\\n↓ grows downward\\nlocal variables, return addrs"]
        Gap1["  "]
        SharedLibs["Shared Libraries / Frameworks\\nmmap'd regions"]
        Gap2["  "]
        Heap["Heap\\n↑ grows upward\\nmalloc / new / alloc"]
        BSS[".bss\\nuninitialized globals"]
        Data[".data\\ninitialized globals"]
        Text[".text\\nexecutable code (read-only)"]
    end
    Kernel --- Stack --- Gap1 --- SharedLibs --- Gap2 --- Heap --- BSS --- Data --- Text`,
        },
        {
          type: 'text',
          content:
            'On iOS, pages are classified as **clean** or **dirty**:\n\n- **Clean pages** contain unmodified data that can be recreated — memory-mapped files, framework code, read-only resources. The OS can evict these freely and reload from disk.\n- **Dirty pages** have been written to by the process — heap allocations, modified globals, stack data. These cannot be evicted without losing data.',
        },
        {
          type: 'callout',
          variant: 'warning',
          content:
            'iOS has no swap file. On macOS, dirty pages can be written to disk (swapped out) and reloaded later. On iOS, dirty pages must stay in RAM or be discarded. When memory pressure is high, iOS sends memory warnings and then kills background apps — starting with those using the most dirty memory. This is why iOS developers obsess over dirty memory footprint.',
        },
        {
          type: 'comparison-table',
          headers: ['', 'Clean Pages', 'Dirty Pages'],
          rows: [
            ['Content', 'Unmodified file-backed data', 'Process-written data'],
            ['Eviction', 'Free — reload from disk', 'Cannot evict on iOS (no swap)'],
            ['Examples', 'mmap\'d files, framework __TEXT', 'malloc\'d memory, stack, modified globals'],
            ['Profiling concern', 'Low — reclaimable', 'High — counts toward memory limit'],
          ],
        },
        {
          type: 'code',
          language: 'c',
          content: `// Demonstrating clean vs dirty pages
#include <sys/mman.h>
#include <fcntl.h>

// Clean: memory-mapped read-only file
int fd = open("data.bin", O_RDONLY);
void *clean = mmap(NULL, 4096, PROT_READ, MAP_PRIVATE, fd, 0);
// Pages stay clean until written to

// Dirty: heap allocation
char *dirty = malloc(4096);
memset(dirty, 0xFF, 4096);  // Writing makes the page dirty`,
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Instruments\' Allocations and VM Tracker instruments distinguish between clean and dirty memory. The Allocations instrument tracks every heap allocation (dirty memory). VM Tracker shows the full virtual memory map. On iOS, the "memory footprint" metric — the number that triggers jetsam kills — is primarily dirty + compressed memory.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 5: System Calls & the Kernel
    // ─────────────────────────────────────────────
    {
      id: 'syscalls-and-kernel',
      title: 'System Calls & the Kernel',
      moduleId: 'os-fundamentals',
      order: 5,
      content: [
        {
          type: 'text',
          content:
            'The CPU runs in two privilege levels. **User space** is where your application code runs — it cannot directly access hardware, other processes\' memory, or kernel data structures. **Kernel space** has full hardware access and manages resources for all processes.',
        },
        {
          type: 'text',
          content:
            'A **system call** (syscall) is the controlled gateway from user space to kernel space. When your code needs to read a file, allocate memory, or send a network packet, it makes a syscall. The CPU switches to kernel mode, executes the kernel function, then returns to user mode with the result.',
        },
        {
          type: 'mermaid',
          content: `sequenceDiagram
    participant App as User Space (App)
    participant CPU as CPU
    participant Kernel as Kernel Space
    participant HW as Hardware

    App->>CPU: syscall instruction (e.g., read)
    Note over CPU: Mode switch: user → kernel
    CPU->>Kernel: Execute sys_read()
    Kernel->>HW: Issue disk read
    HW-->>Kernel: Data ready
    Kernel->>CPU: Copy data to user buffer
    Note over CPU: Mode switch: kernel → user
    CPU-->>App: Return bytes read`,
        },
        {
          type: 'text',
          content:
            'A **mode switch** is not the same as a context switch. A mode switch changes the CPU privilege level (user ↔ kernel) but keeps the same thread running. A context switch saves and restores the entire thread state to run a different thread. Mode switches are faster — typically hundreds of nanoseconds vs microseconds for a full context switch.',
        },
        {
          type: 'comparison-table',
          headers: ['', 'Mode Switch', 'Context Switch'],
          rows: [
            ['What changes', 'CPU privilege level', 'Entire thread state'],
            ['Same thread?', 'Yes', 'No — switches to different thread'],
            ['Saves/restores', 'Minimal register state', 'All registers, stack pointer, page table pointer'],
            ['Cost', '~100-1000 ns', '~1-10 μs + cache effects'],
            ['Triggered by', 'syscall instruction, interrupt', 'Scheduler decision, blocking I/O'],
          ],
        },
        {
          type: 'text',
          content:
            'Common POSIX system calls every developer should know:',
        },
        {
          type: 'comparison-table',
          headers: ['Syscall', 'Purpose', 'Web dev equivalent'],
          rows: [
            ['read / write', 'Read/write file descriptors', 'fs.readFile / fs.writeFile'],
            ['open / close', 'Open/close files', 'fs.open'],
            ['mmap', 'Map files or memory into address space', 'No direct equivalent (ArrayBuffer is closest)'],
            ['fork', 'Create child process (copy of parent)', 'child_process.fork()'],
            ['exec', 'Replace process image with new program', 'No equivalent — exec replaces, not spawns'],
            ['ioctl', 'Device-specific control operations', 'Hardware API calls'],
          ],
        },
        {
          type: 'code',
          language: 'python',
          content: `import os
import sys

# Every "high-level" I/O operation becomes syscalls:
# Python: open() → C: fopen() → kernel: sys_open()
# Python: read() → C: fread() → kernel: sys_read()

fd = os.open("test.txt", os.O_RDONLY)   # syscall: open
data = os.read(fd, 1024)                # syscall: read
os.close(fd)                            # syscall: close

# fork + exec: how shells launch programs
pid = os.fork()                         # syscall: fork
if pid == 0:
    # Child process — replace with new program
    os.execvp("ls", ["ls", "-la"])      # syscall: execve
else:
    # Parent process — wait for child
    os.waitpid(pid, 0)                  # syscall: wait4`,
        },
        {
          type: 'text',
          content:
            'Apple\'s XNU kernel is a hybrid: it combines a **BSD layer** (POSIX syscalls like read, write, mmap) with a **Mach layer** (message-passing microkernel primitives called Mach traps). Your app uses BSD syscalls for file I/O and networking. Mach traps handle lower-level primitives: thread creation, virtual memory manipulation, and inter-process communication (IPC) via Mach ports.',
        },
        {
          type: 'mermaid',
          content: `flowchart TB
    App["Your Application"]
    Frameworks["Apple Frameworks\\n(Foundation, UIKit, libdispatch)"]
    Libsystem["libsystem\\n(libc, libpthread, libdispatch)"]
    subgraph XNU["XNU Kernel"]
        BSD["BSD Layer\\nPOSIX syscalls\\nread, write, mmap, fork"]
        Mach["Mach Layer\\nMach traps\\nthread_create, vm_allocate\\nmach_msg (IPC)"]
        IOKit["I/O Kit\\nDevice drivers"]
    end
    HW["Hardware"]
    App --> Frameworks --> Libsystem
    Libsystem --> BSD
    Libsystem --> Mach
    BSD --> IOKit
    Mach --> IOKit
    IOKit --> HW`,
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Instruments\' System Trace instrument hooks into the syscall boundary. It records every syscall and Mach trap — what was called, which thread called it, how long it took, and whether the thread blocked. This is how you diagnose I/O bottlenecks, lock contention, and excessive IPC.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'You can trace syscalls on macOS right now using `sudo dtruss -p <PID>` (the macOS equivalent of Linux\'s strace). Try it on a running process to see the constant stream of syscalls even an "idle" app makes.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 6: Concurrency Primitives
    // ─────────────────────────────────────────────
    {
      id: 'concurrency-primitives',
      title: 'Concurrency Primitives',
      moduleId: 'os-fundamentals',
      order: 6,
      content: [
        {
          type: 'text',
          content:
            'When multiple threads share data, you need **synchronization primitives** to prevent data races. A data race occurs when two threads access the same memory location concurrently and at least one is writing — the result is undefined behavior.',
        },
        {
          type: 'text',
          content:
            'A **mutex** (mutual exclusion lock) is the most common primitive. A thread *acquires* the mutex before accessing shared data and *releases* it when done. If another thread tries to acquire an already-held mutex, it **blocks** — the OS puts it to sleep until the mutex is released. This guarantees only one thread is in the critical section at a time.',
        },
        {
          type: 'text',
          content:
            'A **semaphore** is a generalized mutex that allows up to N threads to enter simultaneously. A mutex is a semaphore with N=1 (a binary semaphore). Semaphores are useful for limiting concurrency — for example, allowing at most 4 concurrent network downloads.',
        },
        {
          type: 'text',
          content:
            'A **condition variable** lets a thread wait until some condition becomes true. The thread holds a mutex, checks the condition, and if false, calls `wait()` which atomically releases the mutex and blocks. Another thread signals the condition variable after making the condition true, waking the waiting thread.',
        },
        {
          type: 'text',
          content:
            'A **spinlock** does not block on contention — instead the thread *spins* in a tight loop, repeatedly checking if the lock is available. Spinlocks are faster than mutexes when the critical section is tiny (a few instructions) because they avoid the overhead of a kernel-mediated sleep/wake. But they waste CPU cycles if the wait is long.',
        },
        {
          type: 'text',
          content:
            'On Apple platforms, the preferred lock is **os_unfair_lock**. It is a lightweight, non-reentrant lock that sleeps on contention (like a mutex) but avoids the overhead of pthread_mutex. Critically, it supports **priority inheritance** — if a high-priority thread is waiting for the lock, the kernel temporarily boosts the holder\'s priority. This prevents priority inversion. Apple deprecated `OSSpinLock` because it did NOT have priority inheritance.',
        },
        {
          type: 'code',
          language: 'c',
          content: `#include <stdatomic.h>
#include <stdbool.h>

// Simple spinlock using atomic compare-and-swap (CAS)
typedef struct {
    atomic_bool locked;
} spinlock_t;

void spinlock_init(spinlock_t *lock) {
    atomic_store(&lock->locked, false);
}

void spinlock_acquire(spinlock_t *lock) {
    // Spin until we successfully set locked from false to true
    while (atomic_exchange(&lock->locked, true)) {
        // Hint to the CPU that we're in a spin-wait loop
        // On ARM: YIELD instruction; on x86: PAUSE instruction
        __builtin_ia32_pause();  // or use __asm__ volatile("yield")
    }
}

void spinlock_release(spinlock_t *lock) {
    atomic_store(&lock->locked, false);
}`,
        },
        {
          type: 'text',
          content:
            '**Lock-free programming** avoids locks entirely by using **atomic operations** — CPU instructions that read-modify-write a memory location in a single indivisible step. The key primitive is **compare-and-swap (CAS)**: atomically check if a value equals an expected value, and if so, replace it with a new value. If someone else modified it first, CAS fails and you retry.',
        },
        {
          type: 'text',
          content:
            'A classic lock-free data structure is the **single-producer single-consumer (SPSC) ring buffer**. One thread writes, one thread reads, and they coordinate using two atomic indices (head and tail). No lock is needed because each index is only written by one thread and read by the other. This is exactly what our SDK uses to buffer profiling events — the instrumentation thread writes events, and the transport thread reads and sends them.',
        },
        {
          type: 'text',
          content:
            '**Priority inversion** occurs when a high-priority thread is blocked waiting for a lock held by a low-priority thread, while a medium-priority thread preempts the low-priority one. The fix is **priority inheritance**: the OS temporarily boosts the lock holder\'s priority to match the highest-priority waiter. On Apple platforms, `os_unfair_lock` and GCD handle this automatically — this is why Apple recommends them over raw pthread mutexes or spinlocks.',
        },
        {
          type: 'mermaid',
          content: `sequenceDiagram
    participant TH as Thread H (high priority)
    participant TM as Thread M (medium priority)
    participant TL as Thread L (low priority)
    participant Lock as Mutex

    TL->>Lock: Acquire lock
    Note over TL: In critical section
    TH->>Lock: Try acquire → BLOCKED
    Note over TH: Waiting for lock
    TM->>TM: Becomes runnable
    Note over TM,TL: TM preempts TL (higher priority)
    TM->>TM: Running (TL stalled, TH stuck)
    Note over TH,TL: PRIORITY INVERSION!
    Note over TL: Fix: inherit TH priority
    TL->>TL: Boosted to high priority
    TL->>Lock: Release lock
    Lock-->>TH: Lock acquired
    TH->>TH: Running`,
        },
        {
          type: 'comparison-table',
          headers: ['Primitive', 'Blocks?', 'Priority Inheritance', 'Best For', 'Apple Recommendation'],
          rows: [
            ['pthread_mutex', 'Yes (sleeps)', 'Optional (via protocol)', 'General-purpose locking', 'OK but prefer os_unfair_lock'],
            ['Spinlock', 'No (busy-waits)', 'No', 'Very short critical sections', 'Deprecated (OSSpinLock)'],
            ['os_unfair_lock', 'Yes (sleeps)', 'Yes (built-in)', 'Most locking needs on Apple', 'Preferred'],
            ['Lock-free (atomics)', 'No', 'N/A (no lock)', 'SPSC queues, counters', 'Use when correctness is provable'],
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Our SDK\'s ring buffer is lock-free (SPSC) because the instrumentation thread must be as low-overhead as possible — acquiring a lock on every profiling event would distort the measurements. Instruments\' System Trace shows lock contention events, helping you find threads that spend too much time waiting for locks.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 7: Memory Allocation Internals
    // ─────────────────────────────────────────────
    {
      id: 'memory-allocation-internals',
      title: 'Memory Allocation Internals',
      moduleId: 'os-fundamentals',
      order: 7,
      content: [
        {
          type: 'text',
          content:
            'When you call `malloc(64)`, something has to find 64 bytes of free heap memory, mark it as used, and return a pointer. This sounds simple, but the allocator is one of the most performance-critical components in any program — a typical iOS app makes millions of allocations per second.',
        },
        {
          type: 'text',
          content:
            'The simplest approach is a **free list**: the allocator maintains a linked list of free memory blocks. On `malloc`, it walks the list looking for a block large enough (first-fit, best-fit, or worst-fit strategies). On `free`, the block is added back to the list and optionally merged (coalesced) with adjacent free blocks.',
        },
        {
          type: 'text',
          content:
            'The **buddy system** allocator divides memory into power-of-2 sized blocks. To satisfy a 40-byte request, it finds the smallest power-of-2 block that fits (64 bytes). If only a 256-byte block is free, it splits it: 256 → 128 + 128 → 128 + 64 + 64. When a block is freed, the allocator checks its "buddy" (the other half of the split). If the buddy is also free, they merge back. This makes coalescing fast and predictable.',
        },
        {
          type: 'text',
          content:
            '**Slab allocation** is used for objects that are allocated and freed frequently in the same size. The allocator pre-creates pools (slabs) of fixed-size objects. Allocating means grabbing a pre-initialized object from the slab; freeing means returning it. This eliminates fragmentation for common object sizes and is extremely fast. The Linux kernel uses slab allocation extensively; macOS\'s allocator uses a similar concept for small allocations called "tiny" and "small" magazines.',
        },
        {
          type: 'text',
          content:
            '**Stack allocation** is fundamentally different. The stack grows and shrinks with function calls. Allocating on the stack means just moving the stack pointer — a single instruction. Deallocation is automatic when the function returns. Stack allocation is orders of magnitude faster than heap allocation, but the data\'s lifetime is limited to the function scope. In C, `alloca()` or variable-length arrays use stack allocation. In Swift, value types (structs, enums) are often stack-allocated.',
        },
        {
          type: 'comparison-table',
          headers: ['', 'Stack Allocation', 'Heap Allocation'],
          rows: [
            ['Speed', 'Extremely fast (move SP)', 'Slower (search free list, bookkeeping)'],
            ['Lifetime', 'Function scope only', 'Until explicitly freed'],
            ['Fragmentation', 'None (LIFO order)', 'Possible (external + internal)'],
            ['Thread safety', 'Inherently safe (each thread has own stack)', 'Needs synchronization'],
            ['Size limit', 'Small (stack size is limited, ~1-8 MB)', 'Large (limited by virtual address space)'],
          ],
        },
        {
          type: 'text',
          content:
            '**Memory fragmentation** comes in two forms. **External fragmentation**: there\'s enough total free memory, but it\'s scattered in small non-contiguous blocks — no single block is large enough for the request. **Internal fragmentation**: the allocated block is larger than what was requested (e.g., asking for 40 bytes but getting a 64-byte block from the buddy system). The 24 wasted bytes are internal fragmentation.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    subgraph Heap["Heap Memory (External Fragmentation)"]
        direction LR
        B1["USED\\n128B"]
        B2["FREE\\n32B"]
        B3["USED\\n64B"]
        B4["FREE\\n48B"]
        B5["USED\\n256B"]
        B6["FREE\\n16B"]
        B7["USED\\n128B"]
        B1 --- B2 --- B3 --- B4 --- B5 --- B6 --- B7
    end
    Note["Total free: 96B\\nBut largest block: 48B\\nCannot allocate 64B!"]`,
        },
        {
          type: 'text',
          content:
            'On Apple platforms, the heap allocator uses **malloc zones** (`malloc_zone_t`). A zone is a separate heap region with its own free lists and allocation logic. The default zone handles most allocations, but you can create custom zones for different purposes. Each zone has function pointers for `malloc`, `free`, `realloc`, etc.',
        },
        {
          type: 'text',
          content:
            'This zone architecture is exactly how memory profilers hook into allocations. By creating a custom `malloc_zone_t` and registering it (or by replacing the function pointers on the default zone), a profiler can intercept every `malloc` and `free` call. This technique is called **malloc interposition** or **zone replacement**. Our Memory Tracker uses this to record every allocation\'s size, address, and backtrace.',
        },
        {
          type: 'code',
          language: 'c',
          content: `#include <stdlib.h>
#include <stdint.h>

// A simple "bump allocator" to illustrate allocation concepts
// It just moves a pointer forward — no free, no reuse
typedef struct {
    uint8_t *base;      // Start of memory region
    size_t   offset;    // Current position (next free byte)
    size_t   capacity;  // Total size of region
} bump_allocator_t;

void bump_init(bump_allocator_t *a, size_t capacity) {
    a->base = (uint8_t *)malloc(capacity);  // Get a chunk from the real allocator
    a->offset = 0;
    a->capacity = capacity;
}

void *bump_alloc(bump_allocator_t *a, size_t size) {
    // Align to 8 bytes for safety
    size = (size + 7) & ~7;

    if (a->offset + size > a->capacity) {
        return NULL;  // Out of memory
    }

    void *ptr = a->base + a->offset;
    a->offset += size;  // Just bump the pointer forward
    return ptr;
}

// No individual free — reset everything at once
void bump_reset(bump_allocator_t *a) {
    a->offset = 0;
}`,
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Our Memory Tracker uses malloc_zone_t interposition to intercept every allocation and deallocation. By wrapping the default zone\'s function pointers, we record each allocation\'s size, timestamp, and backtrace — all without modifying the application\'s source code. This is the same technique Apple\'s Allocations instrument uses. Understanding malloc internals is critical for interpreting memory profiling data and minimizing the profiler\'s own overhead.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 8: I/O, File Descriptors & Sockets
    // ─────────────────────────────────────────────
    {
      id: 'io-file-descriptors-sockets',
      title: 'I/O, File Descriptors & Sockets',
      moduleId: 'os-fundamentals',
      order: 8,
      content: [
        {
          type: 'text',
          content:
            'Unix has a powerful abstraction: **everything is a file**. Regular files, directories, network sockets, pipes, device drivers, and even pseudo-files like `/dev/null` are all accessed through the same `open/read/write/close` interface. This uniformity is why Unix-like systems are so composable.',
        },
        {
          type: 'text',
          content:
            'When a process opens a resource, the kernel returns a **file descriptor (fd)** — a small non-negative integer. This integer is an index into the process\'s **file descriptor table**, which maps fd numbers to kernel-managed file objects. By convention, fd 0 is stdin, fd 1 is stdout, and fd 2 is stderr.',
        },
        {
          type: 'text',
          content:
            'The kernel maintains three layers. (1) Each process has a **file descriptor table** — an array of pointers. (2) The kernel has a global **open file table** with entries tracking the current file offset, access mode, and a pointer to the underlying object. (3) The **inode table** (or vnode table on macOS) represents the actual file/device/socket.',
        },
        {
          type: 'text',
          content:
            'By default, I/O operations are **blocking**: `read()` on a network socket will put the calling thread to sleep until data arrives. This is simple but does not scale — you\'d need one thread per connection. **Non-blocking I/O** changes this: `read()` returns immediately with `EAGAIN` if no data is available, and the application must poll or be notified when data is ready.',
        },
        {
          type: 'text',
          content:
            'Modern applications use **event loops** with I/O multiplexing to efficiently wait on many file descriptors at once. The kernel provides system calls for this:\n\n- **select/poll**: the original interfaces — pass a set of fds, the kernel tells you which are ready. `poll` is a cleaner API than `select` but both scan the full set on every call (O(n)).\n- **kqueue** (macOS/BSD): register interest once, get notified of events efficiently (O(1) per event). This is what Foundation/CFRunLoop/GCD uses internally on Apple platforms.\n- **epoll** (Linux): similar to kqueue — register once, get events efficiently. Used by Node.js (via libuv) on Linux.',
        },
        {
          type: 'text',
          content:
            '**Network sockets** follow the same fd model. A TCP server calls `socket()` to create a socket fd, `bind()` to assign an address, `listen()` to start accepting connections, and `accept()` to get a new fd for each client. Data flows through `read()`/`write()` on the connection fds.',
        },
        {
          type: 'text',
          content:
            'Our SDK transports profiling data over **WebSocket**, which is itself built on TCP sockets. The stack looks like this: your application generates profiling events → the SDK serializes them to JSON → the JSON is framed in a WebSocket message → WebSocket runs over a TCP socket → TCP is a stream of bytes sent via the kernel\'s network stack → the bytes travel over the network to the InstrumentsOS desktop app.',
        },
        {
          type: 'mermaid',
          content: `sequenceDiagram
    participant App as iOS App (SDK)
    participant Kernel as Kernel (TCP/IP)
    participant Net as Network
    participant Desktop as InstrumentsOS Desktop

    App->>App: Serialize profiling event to JSON
    App->>Kernel: write(socket_fd, websocket_frame)
    Note over Kernel: TCP segmentation, IP routing
    Kernel->>Net: Send TCP packets
    Net->>Kernel: Deliver to desktop
    Note over Kernel: TCP reassembly
    Kernel->>Desktop: kqueue event: data ready
    Desktop->>Desktop: read(socket_fd) → WebSocket frame
    Desktop->>Desktop: Parse JSON → display in UI`,
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Web dev analogy: In Node.js, the event loop uses libuv which calls kqueue on macOS or epoll on Linux. When you do `http.createServer(callback)`, Node registers the server socket with the event loop. Your callback fires when kqueue/epoll reports that a new connection or data has arrived. The concept is identical to what we described — you already understand event-driven I/O.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: File descriptor leaks (opening files/sockets without closing them) are a common bug that profilers help diagnose. Instruments\' File Activity instrument tracks every open/close/read/write syscall. Understanding the fd model also explains why our SDK uses a single persistent WebSocket connection — opening a new TCP connection per event would be catastrophically expensive.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 9: Inter-Process Communication (IPC)
    // ─────────────────────────────────────────────
    {
      id: 'inter-process-communication',
      title: 'Inter-Process Communication (IPC)',
      moduleId: 'os-fundamentals',
      order: 9,
      content: [
        {
          type: 'text',
          content:
            'Processes are isolated by design — each has its own virtual address space. But processes frequently need to communicate: a shell pipes output from one command to another, a browser talks to its GPU process, and Instruments communicates with recording daemons running on a target device. **Inter-Process Communication (IPC)** is how they do it.',
        },
        {
          type: 'text',
          content:
            '**Pipes** are the simplest IPC mechanism. A pipe is a unidirectional byte stream: one process writes, the other reads. The shell command `ls | grep foo` creates a pipe — the stdout of `ls` is connected to the stdin of `grep`. **Named pipes (FIFOs)** are similar but exist as special files in the filesystem, so unrelated processes can open them by name.',
        },
        {
          type: 'text',
          content:
            '**Shared memory** is the fastest IPC mechanism because there\'s no copying — two processes map the same physical memory pages into their virtual address spaces. `mmap` with `MAP_SHARED` or POSIX `shm_open` creates shared regions. The downside: you need explicit synchronization (semaphores or locks) to prevent data races, and it\'s more complex to manage.',
        },
        {
          type: 'text',
          content:
            '**Unix domain sockets** are like network sockets but for local communication — no network stack overhead, just kernel-mediated buffer copying. They support both stream (TCP-like) and datagram (UDP-like) modes. They\'re identified by filesystem paths (e.g., `/var/run/docker.sock`) and are widely used for local client-server communication.',
        },
        {
          type: 'text',
          content:
            'On Apple platforms, the foundational IPC mechanism is **Mach ports**. A Mach port is a kernel-managed, capability-protected communication endpoint. Processes send and receive structured messages through ports. Each process has a **port namespace** — it can only access ports for which it holds a **port right** (send right, receive right, or send-once right). The kernel mediates all message passing.',
        },
        {
          type: 'text',
          content:
            'Mach port messages can carry:\n- Inline data (up to ~256 bytes efficiently)\n- Out-of-line data (for larger payloads — the kernel maps memory from sender to receiver)\n- **Port rights** — you can send a port right inside a message, allowing the receiver to communicate with a third process. This is how capability-based security works in XNU.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    subgraph TaskA["Process A"]
        A_Send["Send Right\\n(to Port X)"]
    end
    subgraph Kernel["XNU Kernel"]
        PortX["Mach Port X\\n(message queue)"]
    end
    subgraph TaskB["Process B"]
        B_Recv["Receive Right\\n(for Port X)"]
    end
    A_Send -->|"mach_msg(send)"| PortX
    PortX -->|"mach_msg(receive)"| B_Recv
    Note["Messages carry: data, port rights, OOL memory"]`,
        },
        {
          type: 'text',
          content:
            '**XPC** is Apple\'s high-level IPC framework built on top of Mach ports. It provides a clean API for creating services that run in separate processes and communicate via structured messages (dictionaries, arrays, data blobs). XPC connections handle serialization, error handling, and process lifecycle automatically. `launchd` manages XPC services — it can start them on demand and restart them if they crash.',
        },
        {
          type: 'text',
          content:
            'Instruments uses XPC extensively. When you profile a remote iOS device, the Instruments app on your Mac communicates with a **recording daemon** running on the device via XPC-over-network (using `remoted`). Even local profiling uses XPC: Instruments spawns helper processes via XPC to isolate the profiling infrastructure from the UI.',
        },
        {
          type: 'comparison-table',
          headers: ['IPC Mechanism', 'Speed', 'Complexity', 'Direction', 'Apple Usage'],
          rows: [
            ['Pipe', 'Medium', 'Low', 'Unidirectional', 'Shell, simple parent-child'],
            ['Shared Memory', 'Fastest (no copy)', 'High (need sync)', 'Bidirectional', 'GPU buffers, IOSurface'],
            ['Unix Domain Socket', 'Fast', 'Medium', 'Bidirectional', 'Local daemons, Docker'],
            ['Mach Ports', 'Fast (kernel-mediated)', 'High', 'Bidirectional', 'Core of XNU IPC'],
            ['XPC', 'Fast (built on Mach)', 'Low (high-level API)', 'Bidirectional', 'Instruments, system services'],
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: Instruments uses XPC to communicate between its UI process and recording daemons. When profiling a remote device, XPC messages travel over a USB/network bridge. Understanding IPC is also interview-critical for Apple platform roles — Mach ports are foundational to how macOS and iOS work, and XPC is how almost all system services communicate.',
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Lesson 10: GPU Architecture Basics
    // ─────────────────────────────────────────────
    {
      id: 'gpu-architecture-basics',
      title: 'GPU Architecture Basics',
      moduleId: 'os-fundamentals',
      order: 10,
      content: [
        {
          type: 'text',
          content:
            'A CPU has a few cores (4-16 on modern consumer chips), each extremely powerful — deep pipelines, large caches, sophisticated branch prediction, out-of-order execution. A CPU core is optimized for **latency**: completing a single task as fast as possible.',
        },
        {
          type: 'text',
          content:
            'A GPU has **thousands of simpler cores**, each much weaker individually — short pipelines, minimal caching, in-order execution. A GPU is optimized for **throughput**: performing the same operation on massive amounts of data simultaneously. This is why GPUs excel at graphics (every pixel needs the same shader computation) and machine learning (matrix multiplications on huge tensors).',
        },
        {
          type: 'mermaid',
          content: `flowchart TB
    subgraph CPU["CPU Architecture"]
        direction LR
        CC1["Core 1\\nALU+FPU+Branch Pred\\nL1 Cache 64KB\\nL2 Cache 256KB"]
        CC2["Core 2\\nALU+FPU+Branch Pred\\nL1 Cache 64KB\\nL2 Cache 256KB"]
        CC3["Core 3\\n..."]
        CC4["Core 4\\n..."]
        CL3["Shared L3 Cache (8-32MB)"]
    end
    subgraph GPU["GPU Architecture"]
        direction LR
        subgraph SM1["Compute Unit 1"]
            G1["32 ALUs"]
            G1S["Shared Mem 16KB"]
        end
        subgraph SM2["Compute Unit 2"]
            G2["32 ALUs"]
            G2S["Shared Mem 16KB"]
        end
        subgraph SM3["Compute Unit N"]
            G3["32 ALUs"]
            G3S["Shared Mem 16KB"]
        end
        GNote["x30-80 Compute Units = 1000-2500+ ALUs"]
    end`,
        },
        {
          type: 'text',
          content:
            'GPU threads are organized hierarchically. Individual **threads** are grouped into **warps** (NVIDIA) or **wavefronts** (AMD) or **SIMD groups** (Apple Metal) — typically 32 threads that execute the same instruction in lockstep (SIMD: Single Instruction, Multiple Data). Warps are grouped into **thread groups** (also called workgroups or blocks), which share a small pool of fast local memory.',
        },
        {
          type: 'text',
          content:
            'The classic **graphics pipeline** processes vertices into pixels through fixed stages:\n\n1. **Vertex stage**: transforms 3D vertices (position, normal, UV coordinates) — runs your vertex shader per vertex\n2. **Rasterization**: converts triangles into fragments (candidate pixels) — fixed-function hardware\n3. **Fragment stage**: computes color for each fragment (texturing, lighting, effects) — runs your fragment shader per fragment\n4. **Framebuffer operations**: depth testing, blending, writing the final pixel color to the framebuffer for display',
        },
        {
          type: 'text',
          content:
            'Apple\'s GPU API is **Metal**. Unlike OpenGL\'s global state machine, Metal uses an explicit command model. You create objects that represent GPU work and submit them through a pipeline:',
        },
        {
          type: 'text',
          content:
            '**MTLCommandQueue** — a serial queue of command buffers. You typically create one per app.\n\n**MTLCommandBuffer** — a container for encoded GPU commands. You create one per frame (or per compute pass).\n\n**MTLRenderCommandEncoder** / **MTLComputeCommandEncoder** — records actual GPU commands (draw calls, dispatch compute kernels, set textures, set buffers). You encode commands, then commit the command buffer to the queue.',
        },
        {
          type: 'mermaid',
          content: `flowchart LR
    App["App (CPU)"]
    CQ["MTLCommandQueue"]
    CB1["MTLCommandBuffer\\n(Frame N)"]
    CB2["MTLCommandBuffer\\n(Frame N+1)"]
    subgraph Encoders["Encode GPU Work"]
        RE["RenderCommandEncoder\\n- Set pipeline state\\n- Set vertex buffer\\n- Draw primitives"]
        CE["ComputeCommandEncoder\\n- Set compute pipeline\\n- Set buffers\\n- Dispatch threads"]
    end
    GPU["GPU Execution"]
    FB["Framebuffer / Result"]

    App --> CQ
    CQ --> CB1
    CQ --> CB2
    CB1 --> Encoders
    Encoders --> GPU
    GPU --> FB`,
        },
        {
          type: 'text',
          content:
            '**Compute shaders** (also called compute kernels) use the GPU for general-purpose computation, not graphics. You define a function that runs on thousands of threads in parallel. Core ML uses **Metal Performance Shaders (MPS)** — optimized compute kernels for neural network operations like convolutions, matrix multiplications, and normalization. When your iOS app runs an ML model, the inference path is: Core ML → MPS → Metal → GPU hardware.',
        },
        {
          type: 'callout',
          variant: 'tip',
          content:
            'Web dev analogy: If you\'ve used WebGL or WebGPU, the concepts are identical. Metal\'s command buffer is like WebGPU\'s GPUCommandEncoder. Metal\'s render pipeline state is like WebGPU\'s GPURenderPipeline. The explicit command model in both APIs is a deliberate departure from OpenGL/WebGL\'s implicit state machine — it gives the driver less guesswork and better performance.',
        },
        {
          type: 'callout',
          variant: 'info',
          content:
            'Why profilers care: InstrumentsOS includes GPU profiling capabilities. The GPU Profiler instrument captures Metal command buffer execution times, shader performance counters, and GPU memory usage. Understanding the command submission model (queue → buffer → encoder) is essential for interpreting GPU traces. Additionally, on-device ML inference (Core ML → MPS → Metal) runs on the GPU, so ML performance issues show up in GPU profiling data.',
        },
      ],
    },
  ],

  quiz: {
    moduleId: 'os-fundamentals',
    questions: [
      {
        id: 'os-fund-q1',
        question:
          'When a profiler "walks the stack," what is it doing?',
        options: [
          'Scanning heap memory for object references',
          'Following frame pointers through the call stack to capture a backtrace',
          'Enumerating all threads in the process',
          'Reading the process\'s page table entries',
        ],
        correctIndex: 1,
        explanation:
          'Stack walking starts at the current frame pointer and follows the chain of saved frame pointers backward through each stack frame, collecting the return address at each step. The result is a backtrace — the sequence of function calls that led to the current point of execution. This is the core mechanism behind sampling profilers like Time Profiler.',
      },
      {
        id: 'os-fund-q2',
        question:
          'What is the key difference between a context switch and a mode switch?',
        options: [
          'A context switch is faster than a mode switch',
          'A mode switch changes privilege level but keeps the same thread; a context switch saves/restores state to run a different thread',
          'A mode switch only happens during system startup',
          'A context switch changes user/kernel mode; a mode switch changes threads',
        ],
        correctIndex: 1,
        explanation:
          'A mode switch toggles the CPU between user mode and kernel mode (e.g., during a syscall) but the same thread continues executing. A context switch saves one thread\'s entire register state and restores another\'s, which is more expensive (~1-10 μs vs ~100-1000 ns) because it also pollutes CPU caches.',
      },
      {
        id: 'os-fund-q3',
        question:
          'Thread A is waiting for a disk read to complete. What state is it in?',
        options: [
          'Running',
          'Ready (runnable)',
          'Blocked (waiting)',
          'Terminated',
        ],
        correctIndex: 2,
        explanation:
          'A thread waiting for I/O is in the Blocked (waiting) state. It cannot run until the I/O completes. Once the disk read finishes, the OS moves the thread to the Ready state, and the scheduler will eventually pick it up to run. This distinction matters for profiling: Time Profiler only samples Running threads, so I/O-bound waits won\'t appear — you need System Trace for that.',
      },
      {
        id: 'os-fund-q4',
        question:
          'Why does iOS care about "dirty" vs "clean" memory pages?',
        options: [
          'Dirty pages use more CPU to access',
          'Clean pages cannot be read by the application',
          'iOS has no swap file, so dirty pages cannot be evicted — they count toward the memory limit that triggers app termination',
          'Dirty pages are automatically compressed and sent to iCloud',
        ],
        correctIndex: 2,
        explanation:
          'iOS does not use swap (unlike macOS). Clean pages can be freely evicted because they can be reloaded from their source (a file on disk, a framework binary). Dirty pages contain data written by the process and cannot be recreated — they must stay in RAM. When memory pressure is high, iOS kills (jetsams) apps with the most dirty memory. This is why Instruments\' memory tools focus on dirty memory footprint.',
      },
      {
        id: 'os-fund-q5',
        question:
          'On Apple platforms, what are the two interfaces to the XNU kernel?',
        options: [
          'POSIX syscalls and Windows NT calls',
          'BSD syscalls and Mach traps',
          'Linux syscalls and Darwin extensions',
          'IOKit calls and Metal shaders',
        ],
        correctIndex: 1,
        explanation:
          'XNU is a hybrid kernel combining a BSD layer (providing POSIX-compatible syscalls like read, write, mmap) and a Mach microkernel layer (providing Mach traps for thread management, virtual memory, and inter-process communication via Mach ports). Most application code uses BSD syscalls through libc, while frameworks like GCD use Mach traps internally.',
      },
      {
        id: 'os-fund-q6',
        question:
          'What happens during priority inversion?',
        options: [
          'A high-priority thread runs when it should be sleeping',
          'A high-priority thread is effectively blocked by a medium-priority thread because the low-priority thread holding a needed lock gets preempted',
          'Two threads swap their priority levels',
          'The scheduler inverts the order of the ready queue',
        ],
        correctIndex: 1,
        explanation:
          'Priority inversion: Thread H (high) waits for a lock held by Thread L (low). Thread M (medium) preempts Thread L because M has higher priority. Now Thread H is indirectly blocked by Thread M, even though H has the highest priority. The fix is priority inheritance — temporarily boost Thread L to Thread H\'s priority so it can finish and release the lock. On iOS, this is managed through QoS classes and os_unfair_lock.',
      },
      {
        id: 'os-fund-q7',
        question:
          'A process has 4 threads. Thread 2 dereferences a null pointer and crashes. What happens?',
        options: [
          'Only Thread 2 is terminated; the other threads continue',
          'The entire process is terminated, killing all 4 threads',
          'Thread 2 restarts automatically',
          'The OS migrates Thread 2\'s work to Thread 3',
        ],
        correctIndex: 1,
        explanation:
          'Threads share the same address space and process context. A crash (like SIGSEGV from a null pointer dereference) is delivered to the process, not just the faulting thread. The OS terminates the entire process, killing all threads. This is why processes provide crash isolation (one process crashing doesn\'t affect others) but threads within a process do not.',
      },
      {
        id: 'os-fund-q8',
        question:
          'Time Profiler shows that your function accounts for 2% of samples, but the feature feels slow. What is the most likely explanation?',
        options: [
          'Time Profiler is broken and needs recalibration',
          'The function is fast but is called millions of times',
          'The thread is spending most of its time in a Blocked state (waiting for I/O, locks, or other threads), which Time Profiler does not capture',
          'The function runs on a core that Time Profiler cannot sample',
        ],
        correctIndex: 2,
        explanation:
          'Time Profiler is a CPU sampling profiler — it only records samples when a thread is in the Running state on a CPU core. If your thread spends most of its wall-clock time blocked (waiting for disk I/O, network, a lock, or a dispatch_sync to another queue), Time Profiler won\'t see that time. Use System Trace or the Thread State instrument to see where threads are waiting.',
      },
      {
        id: 'os-fund-q9',
        question:
          'Why is a single-producer single-consumer (SPSC) ring buffer considered lock-free?',
        options: [
          'It uses a mutex internally but hides it from the caller',
          'Only one thread writes and one thread reads, so they coordinate via atomic indices without any lock',
          'It disables interrupts while accessing shared data',
          'It copies all data to avoid sharing memory between threads',
        ],
        correctIndex: 1,
        explanation:
          'In an SPSC ring buffer, the producer only writes to the head index and the consumer only writes to the tail index. Each thread reads the other\'s index atomically to check for space (producer) or available data (consumer). Since each index has a single writer, no lock is needed — atomic loads and stores provide the necessary synchronization. This is why our SDK uses an SPSC ring buffer for profiling events: zero lock overhead on the hot path.',
      },
      {
        id: 'os-fund-q10',
        question:
          'What Apple API does InstrumentsOS use to hook into memory allocations?',
        options: [
          'Swizzling NSObject\'s alloc method',
          'malloc_zone_t interposition (replacing zone function pointers)',
          'Overriding the C++ global operator new',
          'Using dtrace probes on the malloc function',
        ],
        correctIndex: 1,
        explanation:
          'Apple\'s malloc implementation uses zones (malloc_zone_t), each with function pointers for malloc, free, realloc, etc. By creating a custom zone or replacing the default zone\'s function pointers, a profiler can intercept every heap allocation and deallocation without modifying application source code. This is the same technique used by Apple\'s Allocations instrument.',
      },
      {
        id: 'os-fund-q11',
        question:
          'What is a Mach port?',
        options: [
          'A network port number used by macOS services',
          'A kernel-managed communication endpoint for IPC between tasks, protected by port rights',
          'A USB port abstraction in IOKit',
          'A virtual memory region shared between processes',
        ],
        correctIndex: 1,
        explanation:
          'A Mach port is a kernel-managed, capability-protected communication endpoint in XNU. Processes send and receive structured messages through ports. Access is controlled by port rights (send, receive, send-once). Mach ports are the foundational IPC mechanism on Apple platforms — higher-level frameworks like XPC, distributed notifications, and even pasteboard are built on top of Mach port message passing.',
      },
      {
        id: 'os-fund-q12',
        question:
          'Why does GPU architecture use thousands of cores instead of a few fast ones?',
        options: [
          'Manufacturing thousands of simple cores is cheaper',
          'GPUs need to process massive amounts of data in parallel — the same operation applied to thousands of data points simultaneously (SIMD)',
          'GPU cores run at higher clock speeds than CPU cores',
          'Thousands of cores provide better branch prediction for complex shader programs',
        ],
        correctIndex: 1,
        explanation:
          'GPUs are optimized for throughput, not latency. Graphics and ML workloads are inherently parallel — applying the same shader or matrix operation to thousands of pixels or tensor elements. Thousands of simple cores executing in lockstep (SIMD/SIMT) can process this data far faster than a few powerful cores working sequentially. This is why GPUs excel at rendering and neural network inference.',
      },
      {
        id: 'os-fund-q13',
        question:
          'What is the difference between blocking and non-blocking I/O?',
        options: [
          'Blocking I/O is faster because the kernel optimizes for it',
          'Non-blocking I/O requires special hardware support',
          'Blocking I/O suspends the calling thread until the operation completes; non-blocking I/O returns immediately (with EAGAIN if no data is ready)',
          'Blocking I/O works only with files; non-blocking I/O works only with sockets',
        ],
        correctIndex: 2,
        explanation:
          'With blocking I/O, a call like read() puts the thread to sleep until data is available — simple but ties up a thread per operation. With non-blocking I/O, read() returns immediately with EAGAIN/EWOULDBLOCK if no data is ready, allowing the thread to do other work or check multiple file descriptors. Non-blocking I/O combined with event loops (kqueue/epoll) is how modern servers handle thousands of concurrent connections efficiently.',
      },
      {
        id: 'os-fund-q14',
        question:
          'How does XPC relate to Mach ports?',
        options: [
          'XPC is an alternative to Mach ports that uses shared memory instead',
          'XPC is a high-level framework built on top of Mach port message passing',
          'Mach ports are implemented using XPC internally',
          'XPC and Mach ports are completely independent IPC mechanisms',
        ],
        correctIndex: 1,
        explanation:
          'XPC is Apple\'s high-level IPC framework that abstracts away the complexity of Mach ports. Under the hood, XPC connections use Mach port message passing for data transport. XPC adds structured serialization, error handling, connection lifecycle management, and launchd integration on top of the raw Mach port primitives. This layering is typical of Apple\'s system architecture — high-level frameworks built on foundational kernel mechanisms.',
      },
    ],
    passingScore: 70,
    xpReward: 350,
  },
};

export default module1;
