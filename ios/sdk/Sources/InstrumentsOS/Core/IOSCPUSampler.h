#ifndef IOS_CPU_SAMPLER_H
#define IOS_CPU_SAMPLER_H

#include "IOSRingBuffer.h"
#include <stdbool.h>

/// Start the CPU sampler on a dedicated high-priority thread.
/// Samples all app threads at `frequency_hz` times per second and writes
/// ios_event_t (IOS_EVENT_CPU_SAMPLE) records into `rb`.
/// Returns false if the sampler is already running or thread creation fails.
bool ios_cpu_sampler_start(ios_ring_buffer_t *rb, int frequency_hz);

/// Stop the CPU sampler and join the sampling thread.
void ios_cpu_sampler_stop(void);

/// Returns true if the sampler thread is currently running.
bool ios_cpu_sampler_is_running(void);

#endif /* IOS_CPU_SAMPLER_H */
