#import <Foundation/Foundation.h>
#import "IOSTransport.h"

static NSURLSession           *_session     = nil;
static NSURLSessionWebSocketTask *_wsTask   = nil;
static NSThread               *_drainThread = nil;
static ios_ring_buffer_t      *_ringBuffer  = NULL;
static volatile BOOL           _running     = NO;

// ---------------------------------------------------------------------------
// JSON conversion helpers
// ---------------------------------------------------------------------------

static NSArray *framesArray(const uint64_t *addrs, uint32_t count) {
    NSMutableArray *arr = [NSMutableArray arrayWithCapacity:count];
    for (uint32_t i = 0; i < count; i++) {
        [arr addObject:[NSString stringWithFormat:@"0x%llx", (unsigned long long)addrs[i]]];
    }
    return arr;
}

static NSDictionary *eventToDict(const ios_event_t *ev) {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"timestamp_ns"] = @(ev->timestamp_ns);

    switch (ev->type) {
        case IOS_EVENT_CPU_SAMPLE: {
            dict[@"type"]        = @"cpu_sample";
            dict[@"thread_id"]   = @(ev->cpu_sample.thread_id);
            dict[@"thread_name"] = [NSString stringWithUTF8String:ev->cpu_sample.thread_name];
            dict[@"frame_count"] = @(ev->cpu_sample.frame_count);

            NSMutableArray *frames = [NSMutableArray arrayWithCapacity:ev->cpu_sample.frame_count];
            for (uint32_t i = 0; i < ev->cpu_sample.frame_count; i++) {
                NSString *addr = [NSString stringWithFormat:@"0x%llx",
                                  (unsigned long long)ev->cpu_sample.frames[i]];
                [frames addObject:@{
                    @"address": addr,
                    @"symbol":  [NSNull null]
                }];
            }
            dict[@"frames"] = frames;
            break;
        }
        case IOS_EVENT_MEMORY: {
            dict[@"type"]                = @"memory";
            dict[@"live_bytes"]          = @(ev->memory.live_bytes);
            dict[@"allocation_rate_bps"] = @(ev->memory.allocation_rate_bps);
            dict[@"peak_bytes"]          = @(ev->memory.peak_bytes);
            break;
        }
        case IOS_EVENT_HITCH: {
            dict[@"type"]        = @"hitch";
            dict[@"duration_ms"] = @(ev->hitch.duration_ms);
            dict[@"frame_count"] = @(ev->hitch.frame_count);

            NSMutableArray *stack = [NSMutableArray arrayWithCapacity:ev->hitch.frame_count];
            for (uint32_t i = 0; i < ev->hitch.frame_count; i++) {
                NSString *addr = [NSString stringWithFormat:@"0x%llx",
                                  (unsigned long long)ev->hitch.main_thread_frames[i]];
                [stack addObject:@{
                    @"address": addr,
                    @"symbol":  [NSNull null]
                }];
            }
            dict[@"main_thread_stack"] = stack;
            break;
        }
        case IOS_EVENT_SIGNPOST: {
            dict[@"type"]        = @"signpost";
            dict[@"name"]        = [NSString stringWithUTF8String:ev->signpost.name];
            dict[@"signpost_id"] = @(ev->signpost.signpost_id);

            switch (ev->signpost.event) {
                case IOS_SIGNPOST_BEGIN: dict[@"event"] = @"begin"; break;
                case IOS_SIGNPOST_END:   dict[@"event"] = @"end";   break;
                case IOS_SIGNPOST_EVENT: dict[@"event"] = @"event"; break;
            }
            break;
        }
        case IOS_EVENT_GPU_CMD_BUF: {
            dict[@"type"]            = @"gpu_command_buffer";
            dict[@"label"]           = [NSString stringWithUTF8String:ev->gpu_cmd_buf.label];
            dict[@"gpu_start_ns"]    = @(ev->gpu_cmd_buf.gpu_start_ns);
            dict[@"gpu_end_ns"]      = @(ev->gpu_cmd_buf.gpu_end_ns);
            dict[@"gpu_duration_ms"] = @(ev->gpu_cmd_buf.gpu_duration_ms);
            dict[@"encoder_type"]    = [NSString stringWithUTF8String:ev->gpu_cmd_buf.encoder_type];
            break;
        }
        case IOS_EVENT_GPU_MEMORY: {
            dict[@"type"]            = @"gpu_memory";
            dict[@"allocated_bytes"] = @(ev->gpu_memory.allocated_bytes);
            dict[@"peak_bytes"]      = @(ev->gpu_memory.peak_bytes);
            break;
        }
        case IOS_EVENT_GPU_UTIL: {
            dict[@"type"]             = @"gpu_utilization";
            dict[@"utilization_pct"]  = @(ev->gpu_util.utilization_pct);
            dict[@"vertex_count"]     = @(ev->gpu_util.vertex_count);
            dict[@"fragment_count"]   = @(ev->gpu_util.fragment_count);
            break;
        }
    }
    return dict;
}

static NSString *eventToJSON(const ios_event_t *ev) {
    NSDictionary *dict = eventToDict(ev);
    NSError *err = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict
                                                   options:0
                                                     error:&err];
    if (!data) return nil;
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

// ---------------------------------------------------------------------------
// Drain thread entry point
// ---------------------------------------------------------------------------

static void drainThreadMain(void) {
    @autoreleasepool {
        ios_event_t ev;
        while (_running) {
            @autoreleasepool {
                NSMutableArray *batch = [NSMutableArray array];

                // Read up to 50 events per iteration
                for (int i = 0; i < 50 && ios_ring_buffer_read(_ringBuffer, &ev); i++) {
                    NSString *json = eventToJSON(&ev);
                    if (json) {
                        [batch addObject:eventToDict(&ev)];
                    }
                }

                if (batch.count > 0) {
                    NSError *err = nil;
                    NSData *data = [NSJSONSerialization dataWithJSONObject:batch
                                                                   options:0
                                                                     error:&err];
                    if (data) {
                        NSString *payload = [[NSString alloc] initWithData:data
                                                                  encoding:NSUTF8StringEncoding];
                        NSURLSessionWebSocketMessage *msg =
                            [[NSURLSessionWebSocketMessage alloc] initWithString:payload];
                        [_wsTask sendMessage:msg completionHandler:^(NSError *sendErr) {
                            if (sendErr) {
                                NSLog(@"[InstrumentsOS] WebSocket send error: %@", sendErr);
                            }
                        }];
                    }
                }

                [NSThread sleepForTimeInterval:0.05]; // 50ms
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

bool ios_transport_start(ios_ring_buffer_t *rb, const char *host, int port) {
    if (_running) return false;

    _ringBuffer = rb;
    _running = YES;

    NSString *urlString = [NSString stringWithFormat:@"ws://%s:%d", host, port];
    NSURL *url = [NSURL URLWithString:urlString];

    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    _session = [NSURLSession sessionWithConfiguration:config];
    _wsTask = [_session webSocketTaskWithURL:url];
    [_wsTask resume];

    _drainThread = [[NSThread alloc] initWithBlock:^{
        drainThreadMain();
    }];
    _drainThread.name = @"com.instruments-os.transport";
    _drainThread.qualityOfService = NSQualityOfServiceUtility;
    [_drainThread start];

    return true;
}

void ios_transport_stop(void) {
    _running = NO;

    // Wait for drain thread to finish
    while (_drainThread && !_drainThread.isFinished) {
        [NSThread sleepForTimeInterval:0.01];
    }
    _drainThread = nil;

    [_wsTask cancelWithCloseCode:NSURLSessionWebSocketCloseCodeNormalClosure
                          reason:nil];
    _wsTask = nil;

    [_session invalidateAndCancel];
    _session = nil;

    _ringBuffer = NULL;
}
