#ifndef IOS_MEMORY_TRACKER_H
#define IOS_MEMORY_TRACKER_H

#include "IOSRingBuffer.h"
#include <stdbool.h>

// Start periodic memory tracking. Writes memory events to ring buffer.
// sample_interval_ms: how often to sample memory stats (e.g., 500ms)
bool ios_memory_tracker_start(ios_ring_buffer_t* rb, int sample_interval_ms);
void ios_memory_tracker_stop(void);
bool ios_memory_tracker_is_running(void);

#endif
