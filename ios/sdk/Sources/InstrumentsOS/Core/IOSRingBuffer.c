#include "IOSRingBuffer.h"
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>

struct ios_ring_buffer {
    ios_event_t    *buffer;
    uint32_t        mask;       // capacity - 1, used for fast modulo
    _Atomic uint32_t write_head;
    _Atomic uint32_t read_head;
};

/// Round up to the next power of 2. If already a power of 2, return as-is.
/// Minimum returned value is 1.
static uint32_t next_power_of_2(uint32_t v) {
    if (v == 0) return 1;
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;
    return v;
}

ios_ring_buffer_t *ios_ring_buffer_create(uint32_t count) {
    uint32_t capacity = next_power_of_2(count);

    ios_ring_buffer_t *rb = (ios_ring_buffer_t *)calloc(1, sizeof(ios_ring_buffer_t));
    if (!rb) return NULL;

    rb->buffer = (ios_event_t *)calloc(capacity, sizeof(ios_event_t));
    if (!rb->buffer) {
        free(rb);
        return NULL;
    }

    rb->mask = capacity - 1;
    atomic_init(&rb->write_head, 0);
    atomic_init(&rb->read_head, 0);

    return rb;
}

void ios_ring_buffer_destroy(ios_ring_buffer_t *rb) {
    if (!rb) return;
    free(rb->buffer);
    free(rb);
}

bool ios_ring_buffer_write(ios_ring_buffer_t *rb, const ios_event_t *event) {
    // Load our own write head with relaxed ordering — only we modify it.
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_relaxed);
    // Load the read head with acquire ordering to see the consumer's latest progress.
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_acquire);

    // Full when write is one full lap ahead of read.
    if (w - r > rb->mask) {
        return false;
    }

    memcpy(&rb->buffer[w & rb->mask], event, sizeof(ios_event_t));

    // Publish the write with release ordering so the consumer sees the stored data.
    atomic_store_explicit(&rb->write_head, w + 1, memory_order_release);

    return true;
}

bool ios_ring_buffer_read(ios_ring_buffer_t *rb, ios_event_t *out) {
    // Load our own read head with relaxed ordering — only we modify it.
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_relaxed);
    // Load the write head with acquire ordering to see the producer's latest progress.
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_acquire);

    // Empty when heads are equal.
    if (r == w) {
        return false;
    }

    memcpy(out, &rb->buffer[r & rb->mask], sizeof(ios_event_t));

    // Advance the read head with release ordering so the producer sees we consumed a slot.
    atomic_store_explicit(&rb->read_head, r + 1, memory_order_release);

    return true;
}

uint32_t ios_ring_buffer_count(const ios_ring_buffer_t *rb) {
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_acquire);
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_acquire);
    return w - r;
}
