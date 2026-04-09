#ifndef IOS_EVENT_H
#define IOS_EVENT_H

#include <stdint.h>

#define IOS_MAX_STACK_DEPTH 128
#define IOS_MAX_NAME_LENGTH 256
#define IOS_MAX_THREAD_NAME 64
#define IOS_MAX_ENCODER_TYPE 32

typedef enum {
    IOS_EVENT_CPU_SAMPLE  = 0,
    IOS_EVENT_MEMORY      = 1,
    IOS_EVENT_HITCH       = 2,
    IOS_EVENT_SIGNPOST    = 3,
    IOS_EVENT_GPU_CMD_BUF = 4,
    IOS_EVENT_GPU_MEMORY  = 5,
    IOS_EVENT_GPU_UTIL    = 6,
} ios_event_type_t;

typedef enum {
    IOS_SIGNPOST_BEGIN = 0,
    IOS_SIGNPOST_END   = 1,
    IOS_SIGNPOST_EVENT = 2,
} ios_signpost_event_t;

typedef struct {
    uint64_t thread_id;
    char     thread_name[IOS_MAX_THREAD_NAME];
    uint64_t frames[IOS_MAX_STACK_DEPTH];
    uint32_t frame_count;
} ios_cpu_sample_t;

typedef struct {
    uint64_t live_bytes;
    double   allocation_rate_bps;
    uint64_t peak_bytes;
} ios_memory_t;

typedef struct {
    double   duration_ms;
    uint64_t main_thread_frames[IOS_MAX_STACK_DEPTH];
    uint32_t frame_count;
} ios_hitch_t;

typedef struct {
    ios_signpost_event_t event;
    char                 name[IOS_MAX_NAME_LENGTH];
    uint64_t             signpost_id;
} ios_signpost_t;

typedef struct {
    char     label[IOS_MAX_NAME_LENGTH];
    uint64_t gpu_start_ns;
    uint64_t gpu_end_ns;
    double   gpu_duration_ms;
    char     encoder_type[IOS_MAX_ENCODER_TYPE];
} ios_gpu_cmd_buf_t;

typedef struct {
    uint64_t allocated_bytes;
    uint64_t peak_bytes;
} ios_gpu_memory_t;

typedef struct {
    double   utilization_pct;
    uint64_t vertex_count;
    uint64_t fragment_count;
} ios_gpu_util_t;

typedef struct {
    ios_event_type_t type;
    uint64_t         timestamp_ns;
    union {
        ios_cpu_sample_t  cpu_sample;
        ios_memory_t      memory;
        ios_hitch_t       hitch;
        ios_signpost_t    signpost;
        ios_gpu_cmd_buf_t gpu_cmd_buf;
        ios_gpu_memory_t  gpu_memory;
        ios_gpu_util_t    gpu_util;
    };
} ios_event_t;

#endif /* IOS_EVENT_H */
