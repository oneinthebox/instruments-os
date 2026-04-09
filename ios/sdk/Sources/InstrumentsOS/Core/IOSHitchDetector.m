#import "IOSHitchDetector.h"
#import "IOSEvent.h"
#import "IOSRingBuffer.h"

#import <Foundation/Foundation.h>
#import <TargetConditionals.h>

#import <mach/mach.h>
#import <mach/mach_time.h>
#import <pthread.h>
#import <stdatomic.h>
#import <string.h>

// CADisplayLink is always available on iOS; on macOS it requires 14.0+.
// We guard the entire implementation with TARGET_OS_IPHONE so it compiles
// cleanly on older macOS deployment targets (the SDK ships primarily for iOS).
#if TARGET_OS_IPHONE
#import <QuartzCore/CADisplayLink.h>
#endif

// ---------------------------------------------------------------------------
// Frame-pointer stack walk (same approach as IOSCPUSampler.c)
// ---------------------------------------------------------------------------

static uint32_t walk_stack_local(uint64_t *frames, uint32_t max_depth) {
    uint32_t count = 0;

    // Capture the current PC as the first frame.
    void *ret_addr = __builtin_return_address(0);
    if (ret_addr && count < max_depth) {
        frames[count++] = (uint64_t)ret_addr;
    }

    // Start walking from the current frame pointer.
    void *fp = __builtin_frame_address(0);

    while (fp && count < max_depth) {
        // Each frame on the stack:
        //   [fp + 0] -> saved frame pointer (caller's fp)
        //   [fp + 8] -> return address

        // Read using vm_read_overwrite for safety against unmapped pages.
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
        uint64_t ret = frame_data[1];

        if (ret == 0) {
            break;
        }

        frames[count++] = ret;

        // Detect infinite loops / corrupted chains.
        if (saved_fp <= (uint64_t)fp) {
            break;
        }
        fp = (void *)saved_fp;
    }

    return count;
}

// ---------------------------------------------------------------------------
// Mach timestamp helper
// ---------------------------------------------------------------------------

static mach_timebase_info_data_t s_timebase;
static bool s_timebase_initialized = false;

static uint64_t timestamp_ns(void) {
    if (!s_timebase_initialized) {
        mach_timebase_info(&s_timebase);
        s_timebase_initialized = true;
    }
    uint64_t t = mach_absolute_time();
    return t * s_timebase.numer / s_timebase.denom;
}

#if TARGET_OS_IPHONE

// ---------------------------------------------------------------------------
// IOSHitchDetectorHelper — ObjC class wrapping CADisplayLink (iOS only)
// ---------------------------------------------------------------------------

@interface IOSHitchDetectorHelper : NSObject {
    CADisplayLink     *_displayLink;
    ios_ring_buffer_t *_ringBuffer;
    double             _thresholdMs;
    CFTimeInterval     _lastTimestamp;
}

- (instancetype)initWithRingBuffer:(ios_ring_buffer_t *)rb thresholdMs:(double)threshold;
- (BOOL)start;
- (void)stop;

@end

@implementation IOSHitchDetectorHelper

- (instancetype)initWithRingBuffer:(ios_ring_buffer_t *)rb thresholdMs:(double)threshold {
    self = [super init];
    if (self) {
        _ringBuffer   = rb;
        _thresholdMs  = threshold;
        _lastTimestamp = 0;
    }
    return self;
}

- (BOOL)start {
    if (_displayLink) {
        return NO; // Already running.
    }

    _displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(displayLinkFired:)];
    [_displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
    return YES;
}

- (void)stop {
    [_displayLink invalidate];
    _displayLink = nil;
}

- (void)displayLinkFired:(CADisplayLink *)link {
    CFTimeInterval currentTimestamp = link.timestamp;

    if (_lastTimestamp > 0) {
        double gapMs = (currentTimestamp - _lastTimestamp) * 1000.0;

        if (gapMs > _thresholdMs) {
            // A hitch occurred — the callback was delayed.
            // Capture the current main-thread stack (we ARE on the main thread).
            ios_event_t event;
            memset(&event, 0, sizeof(event));
            event.type         = IOS_EVENT_HITCH;
            event.timestamp_ns = timestamp_ns();
            event.data.hitch.duration_ms = gapMs;

            event.data.hitch.frame_count = walk_stack_local(
                event.data.hitch.main_thread_frames,
                IOS_MAX_STACK_DEPTH
            );

            ios_ring_buffer_write(_ringBuffer, &event);
        }
    }

    _lastTimestamp = currentTimestamp;
}

@end

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

static _Atomic bool s_running = false;
static IOSHitchDetectorHelper *s_helper = nil;

// ---------------------------------------------------------------------------
// Public C API
// ---------------------------------------------------------------------------

bool ios_hitch_detector_start(ios_ring_buffer_t *rb, double threshold_ms) {
    if (!rb || threshold_ms <= 0) {
        return false;
    }

    // If already running, refuse a second start.
    bool expected = false;
    if (!atomic_compare_exchange_strong(&s_running, &expected, true)) {
        return false;
    }

    s_helper = [[IOSHitchDetectorHelper alloc] initWithRingBuffer:rb thresholdMs:threshold_ms];

    // The display link must be added on the main thread.
    if ([NSThread isMainThread]) {
        if (![s_helper start]) {
            s_helper = nil;
            atomic_store(&s_running, false);
            return false;
        }
    } else {
        dispatch_sync(dispatch_get_main_queue(), ^{
            [s_helper start];
        });
    }

    return true;
}

void ios_hitch_detector_stop(void) {
    bool expected = true;
    if (!atomic_compare_exchange_strong(&s_running, &expected, false)) {
        return; // Was not running.
    }

    if ([NSThread isMainThread]) {
        [s_helper stop];
    } else {
        dispatch_sync(dispatch_get_main_queue(), ^{
            [s_helper stop];
        });
    }

    s_helper = nil;
}

bool ios_hitch_detector_is_running(void) {
    return atomic_load_explicit(&s_running, memory_order_acquire);
}

#else // !TARGET_OS_IPHONE — macOS stub

// CADisplayLink is not reliably available on all macOS deployment targets.
// The hitch detector is an iOS-only feature; provide no-op stubs for macOS
// so the library links cleanly on both platforms.

bool ios_hitch_detector_start(ios_ring_buffer_t *rb, double threshold_ms) {
    (void)rb;
    (void)threshold_ms;
    return false;
}

void ios_hitch_detector_stop(void) {
    // No-op on macOS.
}

bool ios_hitch_detector_is_running(void) {
    return false;
}

#endif // TARGET_OS_IPHONE
