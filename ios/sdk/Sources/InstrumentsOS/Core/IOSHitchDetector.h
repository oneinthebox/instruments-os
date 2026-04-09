#ifndef IOS_HITCH_DETECTOR_H
#define IOS_HITCH_DETECTOR_H

#include "IOSRingBuffer.h"
#include <stdbool.h>

// Start hitch detection. Uses CADisplayLink to detect missed frames.
// threshold_ms: minimum gap to consider a hitch (e.g., 33.0 for 30fps threshold)
bool ios_hitch_detector_start(ios_ring_buffer_t* rb, double threshold_ms);
void ios_hitch_detector_stop(void);
bool ios_hitch_detector_is_running(void);

#endif /* IOS_HITCH_DETECTOR_H */
