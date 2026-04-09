import Testing
@testable import InstrumentsOS

@Suite("Ring Buffer Tests")
struct RingBufferTests {

    @Test("Create and destroy — count is 0")
    func createDestroy() {
        let rb = ios_ring_buffer_create(16)!
        #expect(ios_ring_buffer_count(rb) == 0)
        ios_ring_buffer_destroy(rb)
    }

    @Test("Write and read back a memory event")
    func writeRead() {
        let rb = ios_ring_buffer_create(16)!

        var event = ios_event_t()
        event.type = IOS_EVENT_MEMORY
        event.timestamp_ns = 123_456_789
        event.memory.live_bytes = 4096
        event.memory.allocation_rate_bps = 1024.5
        event.memory.peak_bytes = 8192

        let wrote = ios_ring_buffer_write(rb, &event)
        #expect(wrote == true)
        #expect(ios_ring_buffer_count(rb) == 1)

        var out = ios_event_t()
        let read = ios_ring_buffer_read(rb, &out)
        #expect(read == true)
        #expect(ios_ring_buffer_count(rb) == 0)

        #expect(out.type == IOS_EVENT_MEMORY)
        #expect(out.timestamp_ns == 123_456_789)
        #expect(out.memory.live_bytes == 4096)
        #expect(out.memory.allocation_rate_bps == 1024.5)
        #expect(out.memory.peak_bytes == 8192)

        ios_ring_buffer_destroy(rb)
    }

    @Test("Empty read returns false")
    func emptyRead() {
        let rb = ios_ring_buffer_create(16)!
        var out = ios_event_t()
        let read = ios_ring_buffer_read(rb, &out)
        #expect(read == false)
        ios_ring_buffer_destroy(rb)
    }

    @Test("Full buffer — overflow returns false")
    func fullBuffer() {
        let capacity: UInt32 = 4  // power of 2
        let rb = ios_ring_buffer_create(capacity)!

        var event = ios_event_t()
        event.type = IOS_EVENT_CPU_SAMPLE

        // Fill to capacity
        for i in 0..<capacity {
            event.timestamp_ns = UInt64(i)
            let wrote = ios_ring_buffer_write(rb, &event)
            #expect(wrote == true)
        }

        #expect(ios_ring_buffer_count(rb) == capacity)

        // Next write should fail — buffer is full
        let overflow = ios_ring_buffer_write(rb, &event)
        #expect(overflow == false)

        ios_ring_buffer_destroy(rb)
    }
}
