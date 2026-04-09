#ifndef IOS_RING_BUFFER_H
#define IOS_RING_BUFFER_H

#include <stdbool.h>
#include <stdint.h>
#include "IOSEvent.h"

typedef struct ios_ring_buffer ios_ring_buffer_t;

/// Create a ring buffer with at least `count` slots.
/// Actual capacity is rounded up to the next power of 2.
/// Returns NULL on allocation failure.
ios_ring_buffer_t *ios_ring_buffer_create(uint32_t count);

/// Destroy a ring buffer and free its memory.
void ios_ring_buffer_destroy(ios_ring_buffer_t *rb);

/// Write an event into the ring buffer (producer side).
/// Returns false if the buffer is full.
bool ios_ring_buffer_write(ios_ring_buffer_t *rb, const ios_event_t *event);

/// Read an event from the ring buffer (consumer side).
/// Returns false if the buffer is empty.
bool ios_ring_buffer_read(ios_ring_buffer_t *rb, ios_event_t *out);

/// Return the number of unread events currently in the buffer.
uint32_t ios_ring_buffer_count(const ios_ring_buffer_t *rb);

#endif /* IOS_RING_BUFFER_H */
