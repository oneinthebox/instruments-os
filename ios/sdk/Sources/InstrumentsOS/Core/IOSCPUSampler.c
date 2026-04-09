#include "IOSCPUSampler.h"
#include "IOSEvent.h"
#include "IOSRingBuffer.h"

#include <mach/mach.h>
#include <mach/mach_time.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/// Atomic flag: 1 while the sampler loop should keep running.
static _Atomic bool s_running = false;

/// Pointer to the ring buffer we write samples into (set in _start, read in loop).
static ios_ring_buffer_t *s_ring_buffer = NULL;

/// Sampling interval in microseconds (1 000 000 / frequency_hz).
static useconds_t s_interval_us = 0;

/// The pthread running the sampler loop.
static pthread_t s_thread;

/// Mach timebase info cached once at start.
static mach_timebase_info_data_t s_timebase;

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

static uint64_t timestamp_ns(void) {
    uint64_t t = mach_absolute_time();
    return t * s_timebase.numer / s_timebase.denom;
}

// ---------------------------------------------------------------------------
// Frame-pointer stack walk
// ---------------------------------------------------------------------------

/// Walk the frame-pointer chain starting from `fp` and record return addresses
/// into `frames`.  Returns the number of frames captured (up to `max_depth`).
///
/// Safety: we read two pointers (saved_fp, return_address) at each frame.
/// We stop when fp falls below 0x1000 (null-page guard), when we exceed
/// max_depth, or when vm_read_overwrite fails (unmapped memory).
static uint32_t walk_stack(uint64_t fp, uint64_t pc, uint64_t *frames, uint32_t max_depth) {
    uint32_t count = 0;

    // Record the instruction pointer as the first frame.
    if (count < max_depth) {
        frames[count++] = pc;
    }

    // Walk the frame-pointer chain.
    while (fp > 0x1000 && count < max_depth) {
        // Each frame on the stack looks like:
        //   [fp + 0]  -> saved frame pointer (caller's fp)
        //   [fp + 8]  -> return address
        uint64_t frame_data[2] = {0, 0};
        vm_size_t bytes_read = 0;
        kern_return_t kr = vm_read_overwrite(
            mach_task_self(),
            (vm_address_t)fp,
            sizeof(frame_data),
            (vm_address_t)frame_data,
            &bytes_read
        );
        if (kr != KERN_SUCCESS || bytes_read < sizeof(frame_data)) {
            break;
        }

        uint64_t saved_fp = frame_data[0];
        uint64_t ret_addr = frame_data[1];

        if (ret_addr == 0) {
            break;
        }

        frames[count++] = ret_addr;

        // Detect infinite loops / corrupted chains.
        if (saved_fp <= fp) {
            break;
        }
        fp = saved_fp;
    }

    return count;
}

// ---------------------------------------------------------------------------
// Per-thread sampling
// ---------------------------------------------------------------------------

/// Sample a single Mach thread: suspend, read registers, walk stack, resume.
/// Writes an ios_event_t into the ring buffer.
static void sample_thread(thread_act_t thread, uint64_t ts_ns) {
    // Suspend the thread so we can safely read its registers.
    kern_return_t kr = thread_suspend(thread);
    if (kr != KERN_SUCCESS) {
        return;
    }

    uint64_t fp = 0;
    uint64_t pc = 0;
    bool got_state = false;

#if defined(__arm64__) || defined(__aarch64__)
    arm_thread_state64_t state;
    mach_msg_type_number_t count = ARM_THREAD_STATE64_COUNT;
    kr = thread_get_state(thread, ARM_THREAD_STATE64, (thread_state_t)&state, &count);
    if (kr == KERN_SUCCESS) {
        fp = arm_thread_state64_get_fp(state);
        pc = arm_thread_state64_get_pc(state);
        got_state = true;
    }
#elif defined(__x86_64__)
    x86_thread_state64_t state;
    mach_msg_type_number_t count = x86_THREAD_STATE64_COUNT;
    kr = thread_get_state(thread, x86_THREAD_STATE64, (thread_state_t)&state, &count);
    if (kr == KERN_SUCCESS) {
        fp = state.__rbp;
        pc = state.__rip;
        got_state = true;
    }
#endif

    // Always resume the thread, regardless of whether we got the state.
    thread_resume(thread);

    if (!got_state) {
        return;
    }

    // Build the event.
    ios_event_t event;
    memset(&event, 0, sizeof(event));
    event.type = IOS_EVENT_CPU_SAMPLE;
    event.timestamp_ns = ts_ns;
    event.cpu_sample.thread_id = (uint64_t)thread;

    // Try to get the thread's pthread name.
    // thread_info can give us the Mach-level name; we try pthread_getname_np
    // only for the current task's threads (which they all are).
    pthread_t pthread_handle = pthread_from_mach_thread_np(thread);
    if (pthread_handle) {
        pthread_getname_np(pthread_handle, event.cpu_sample.thread_name,
                           IOS_MAX_THREAD_NAME);
    }

    // Walk the stack.
    event.cpu_sample.frame_count = walk_stack(fp, pc,
                                              event.cpu_sample.frames,
                                              IOS_MAX_STACK_DEPTH);

    // Write to the ring buffer (drop if full — non-blocking).
    ios_ring_buffer_write(s_ring_buffer, &event);
}

// ---------------------------------------------------------------------------
// Sampler loop (runs on the dedicated thread)
// ---------------------------------------------------------------------------

static void *sampler_loop(void *arg) {
    (void)arg;

    // Identify our own Mach thread port so we skip ourselves during sampling.
    mach_port_t self_thread = mach_thread_self();

    while (atomic_load_explicit(&s_running, memory_order_acquire)) {
        uint64_t ts = timestamp_ns();

        // Enumerate all threads in the current task.
        thread_act_array_t threads = NULL;
        mach_msg_type_number_t thread_count = 0;
        kern_return_t kr = task_threads(mach_task_self(), &threads, &thread_count);
        if (kr != KERN_SUCCESS) {
            usleep(s_interval_us);
            continue;
        }

        for (mach_msg_type_number_t i = 0; i < thread_count; i++) {
            // Skip the sampler thread itself.
            if (threads[i] == self_thread) {
                mach_port_deallocate(mach_task_self(), threads[i]);
                continue;
            }
            sample_thread(threads[i], ts);
            mach_port_deallocate(mach_task_self(), threads[i]);
        }

        // Deallocate the thread list allocated by task_threads.
        vm_deallocate(mach_task_self(),
                      (vm_address_t)threads,
                      sizeof(thread_act_t) * thread_count);

        usleep(s_interval_us);
    }

    // Clean up our self port.
    mach_port_deallocate(mach_task_self(), self_thread);

    return NULL;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

bool ios_cpu_sampler_start(ios_ring_buffer_t *rb, int frequency_hz) {
    if (!rb || frequency_hz <= 0) {
        return false;
    }

    // If already running, refuse a second start.
    bool expected = false;
    if (!atomic_compare_exchange_strong(&s_running, &expected, true)) {
        return false;
    }

    s_ring_buffer = rb;
    s_interval_us = (useconds_t)(1000000 / frequency_hz);

    // Cache the Mach timebase.
    mach_timebase_info(&s_timebase);

    // Create a high-priority sampling thread.
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_JOINABLE);

    // Set the scheduling policy to real-time FIFO with priority 47
    // (same priority range used by CoreAudio / profilers).
    struct sched_param sched;
    memset(&sched, 0, sizeof(sched));
    sched.sched_priority = 47;
    pthread_attr_setschedpolicy(&attr, SCHED_FIFO);
    pthread_attr_setschedparam(&attr, &sched);

    int rc = pthread_create(&s_thread, &attr, sampler_loop, NULL);
    pthread_attr_destroy(&attr);

    if (rc != 0) {
        atomic_store(&s_running, false);
        s_ring_buffer = NULL;
        return false;
    }

    return true;
}

void ios_cpu_sampler_stop(void) {
    bool expected = true;
    if (!atomic_compare_exchange_strong(&s_running, &expected, false)) {
        return; // Was not running.
    }

    pthread_join(s_thread, NULL);
    s_ring_buffer = NULL;
}

bool ios_cpu_sampler_is_running(void) {
    return atomic_load_explicit(&s_running, memory_order_acquire);
}
