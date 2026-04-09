#include "IOSMemoryTracker.h"
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

/// Atomic flag: true while the tracker loop should keep running.
static _Atomic bool s_running = false;

/// Pointer to the ring buffer we write memory events into.
static ios_ring_buffer_t *s_ring_buffer = NULL;

/// Sampling interval in microseconds.
static useconds_t s_interval_us = 0;

/// The pthread running the tracker loop.
static pthread_t s_thread;

/// Mach timebase info cached once at start.
static mach_timebase_info_data_t s_timebase;

/// Previous phys_footprint for computing allocation rate.
static uint64_t s_prev_phys_footprint = 0;

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

static uint64_t timestamp_ns(void) {
    uint64_t t = mach_absolute_time();
    return t * s_timebase.numer / s_timebase.denom;
}

// ---------------------------------------------------------------------------
// Memory sampling
// ---------------------------------------------------------------------------

/// Sample current memory usage via task_vm_info and write an event.
static void sample_memory(uint64_t ts_ns, double interval_sec) {
    task_vm_info_data_t vm_info;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    kern_return_t kr = task_info(mach_task_self(), TASK_VM_INFO,
                                 (task_info_t)&vm_info, &count);
    if (kr != KERN_SUCCESS) {
        return;
    }

    uint64_t live = vm_info.phys_footprint;

    // ledger_phys_footprint_peak is available from rev3 onwards;
    // fall back to resident_size if the kernel returned a truncated struct.
    uint64_t peak;
    if (count >= TASK_VM_INFO_REV3_COUNT) {
        peak = (uint64_t)vm_info.ledger_phys_footprint_peak;
    } else {
        peak = vm_info.resident_size;
    }

    // Compute allocation rate (bytes per second).
    double alloc_rate = 0.0;
    if (s_prev_phys_footprint > 0 && interval_sec > 0.0) {
        int64_t delta = (int64_t)(live - s_prev_phys_footprint);
        alloc_rate = (double)delta / interval_sec;
    }
    s_prev_phys_footprint = live;

    // Build and write the event.
    ios_event_t event;
    memset(&event, 0, sizeof(event));
    event.type = IOS_EVENT_MEMORY;
    event.timestamp_ns = ts_ns;
    event.memory.live_bytes = live;
    event.memory.peak_bytes = peak;
    event.memory.allocation_rate_bps = alloc_rate;

    ios_ring_buffer_write(s_ring_buffer, &event);
}

// ---------------------------------------------------------------------------
// Tracker loop (runs on the dedicated thread)
// ---------------------------------------------------------------------------

static void *tracker_loop(void *arg) {
    (void)arg;

    double interval_sec = (double)s_interval_us / 1000000.0;

    while (atomic_load_explicit(&s_running, memory_order_acquire)) {
        uint64_t ts = timestamp_ns();
        sample_memory(ts, interval_sec);
        usleep(s_interval_us);
    }

    return NULL;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

bool ios_memory_tracker_start(ios_ring_buffer_t *rb, int sample_interval_ms) {
    if (!rb || sample_interval_ms <= 0) {
        return false;
    }

    // If already running, refuse a second start.
    bool expected = false;
    if (!atomic_compare_exchange_strong(&s_running, &expected, true)) {
        return false;
    }

    s_ring_buffer = rb;
    s_interval_us = (useconds_t)(sample_interval_ms * 1000);
    s_prev_phys_footprint = 0;

    // Cache the Mach timebase.
    mach_timebase_info(&s_timebase);

    // Create the tracker thread.
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_JOINABLE);

    int rc = pthread_create(&s_thread, &attr, tracker_loop, NULL);
    pthread_attr_destroy(&attr);

    if (rc != 0) {
        atomic_store(&s_running, false);
        s_ring_buffer = NULL;
        return false;
    }

    return true;
}

void ios_memory_tracker_stop(void) {
    bool expected = true;
    if (!atomic_compare_exchange_strong(&s_running, &expected, false)) {
        return; // Was not running.
    }

    pthread_join(s_thread, NULL);
    s_ring_buffer = NULL;
}

bool ios_memory_tracker_is_running(void) {
    return atomic_load_explicit(&s_running, memory_order_acquire);
}
