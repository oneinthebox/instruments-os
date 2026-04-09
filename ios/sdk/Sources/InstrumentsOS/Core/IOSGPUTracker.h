#ifndef IOS_GPU_TRACKER_H
#define IOS_GPU_TRACKER_H

#include "IOSRingBuffer.h"
#include <stdbool.h>

// Start GPU tracking. Samples GPU memory periodically.
// memory_sample_interval_ms: how often to sample GPU memory (e.g., 1000ms)
bool ios_gpu_tracker_start(ios_ring_buffer_t* rb, int memory_sample_interval_ms);
void ios_gpu_tracker_stop(void);
bool ios_gpu_tracker_is_running(void);

// The ObjC-only function for tracking command buffers is declared in
// IOSGPUTracker.m and called from Swift via the InstrumentsOS facade.
// It cannot be declared here because MTLCommandBuffer requires ObjC context.

#endif /* IOS_GPU_TRACKER_H */
