#import "IOSGPUTracker.h"
#import <Metal/Metal.h>
#import <mach/mach_time.h>
#import <string.h>

// ---------------------------------------------------------------------------
// Mach absolute-time -> nanoseconds conversion
// ---------------------------------------------------------------------------
static uint64_t mach_time_to_ns(uint64_t mach_ticks) {
    static mach_timebase_info_data_t info;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        mach_timebase_info(&info);
    });
    return mach_ticks * info.numer / info.denom;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
static ios_ring_buffer_t *_rb       = nil;
static id<MTLDevice>      _device   = nil;
static BOOL               _running  = NO;
static NSThread           *_memoryThread = nil;
static int                _interval_ms   = 1000;

// ---------------------------------------------------------------------------
// GPU Memory Sampling Thread
// ---------------------------------------------------------------------------
@interface _IOSGPUMemorySampler : NSObject
+ (void)sampleLoop;
@end

@implementation _IOSGPUMemorySampler
+ (void)sampleLoop {
    while (_running) {
        @autoreleasepool {
            if (!_running || !_rb || !_device) break;

            ios_event_t event;
            memset(&event, 0, sizeof(event));
            event.type         = IOS_EVENT_GPU_MEMORY;
            event.timestamp_ns = mach_time_to_ns(mach_absolute_time());
            event.gpu_memory.allocated_bytes = (uint64_t)_device.currentAllocatedSize;
            event.gpu_memory.peak_bytes      = 0; // Metal does not expose peak; kept for future use

            ios_ring_buffer_write(_rb, &event);

            [NSThread sleepForTimeInterval:_interval_ms / 1000.0];
        }
    }
}
@end

// ---------------------------------------------------------------------------
// Public: command buffer tracking
// ---------------------------------------------------------------------------
void ios_gpu_track_command_buffer(id<MTLCommandBuffer> cmdBuf) {
    if (!_running || !_rb || !cmdBuf) return;

    ios_ring_buffer_t *rb = _rb; // capture for block

    [cmdBuf addCompletedHandler:^(id<MTLCommandBuffer> buf) {
        if (!rb) return;

        ios_event_t event;
        memset(&event, 0, sizeof(event));
        event.type         = IOS_EVENT_GPU_CMD_BUF;
        event.timestamp_ns = mach_time_to_ns(mach_absolute_time());

        // GPUStartTime / GPUEndTime are CFTimeInterval (seconds since system boot)
        CFTimeInterval gpuStart = buf.GPUStartTime;
        CFTimeInterval gpuEnd   = buf.GPUEndTime;

        event.gpu_cmd_buf.gpu_start_ns   = (uint64_t)(gpuStart * 1e9);
        event.gpu_cmd_buf.gpu_end_ns     = (uint64_t)(gpuEnd   * 1e9);
        event.gpu_cmd_buf.gpu_duration_ms = (gpuEnd - gpuStart) * 1000.0;

        const char *label = buf.label ? buf.label.UTF8String : "unlabeled";
        strncpy(event.gpu_cmd_buf.label, label, IOS_MAX_NAME_LENGTH - 1);
        event.gpu_cmd_buf.label[IOS_MAX_NAME_LENGTH - 1] = '\0';

        strncpy(event.gpu_cmd_buf.encoder_type, "command", IOS_MAX_ENCODER_TYPE - 1);
        event.gpu_cmd_buf.encoder_type[IOS_MAX_ENCODER_TYPE - 1] = '\0';

        ios_ring_buffer_write(rb, &event);
    }];
}

// ---------------------------------------------------------------------------
// Public: lifecycle
// ---------------------------------------------------------------------------
bool ios_gpu_tracker_start(ios_ring_buffer_t *rb, int memory_sample_interval_ms) {
    if (_running) return false;

    _rb          = rb;
    _interval_ms = memory_sample_interval_ms > 0 ? memory_sample_interval_ms : 1000;
    _device      = MTLCreateSystemDefaultDevice();

    if (!_device) {
        // Metal not available (e.g., simulator without GPU support)
        _rb = nil;
        return false;
    }

    _running = YES;

    // Spawn a dedicated thread for periodic GPU memory sampling
    _memoryThread = [[NSThread alloc] initWithTarget:[_IOSGPUMemorySampler class]
                                            selector:@selector(sampleLoop)
                                              object:nil];
    _memoryThread.name = @"com.instruments-os.gpu-memory";
    _memoryThread.qualityOfService = NSQualityOfServiceUtility;
    [_memoryThread start];

    return true;
}

void ios_gpu_tracker_stop(void) {
    _running = NO;

    // Wait briefly for the memory thread to exit its loop
    if (_memoryThread) {
        [_memoryThread cancel];
        _memoryThread = nil;
    }

    _device = nil;
    _rb     = nil;
}

bool ios_gpu_tracker_is_running(void) {
    return _running;
}
