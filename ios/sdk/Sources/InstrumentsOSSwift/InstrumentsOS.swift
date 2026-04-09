import Foundation
@_exported import CInstrumentsOS

/// Public facade for the InstrumentsOS profiling SDK.
///
/// Usage:
/// ```swift
/// InstrumentsOS.configure(host: "192.168.1.5", port: 8765)
/// InstrumentsOS.startProfiling()
/// // ... app runs ...
/// InstrumentsOS.stopProfiling()
/// ```
public enum InstrumentsOS {

    // MARK: - Signpost type

    public enum SignpostType {
        case begin
        case end
        case event
    }

    // MARK: - Private state

    private static var host: String = "127.0.0.1"
    private static var port: Int    = 8765
    // ios_ring_buffer_t is an opaque struct; Swift imports the pointer as OpaquePointer.
    private static var ringBuffer: OpaquePointer? = nil

    // MARK: - Public API

    /// Configure the target host and port for the profiling backend.
    public static func configure(host: String, port: Int) {
        Self.host = host
        Self.port = port
    }

    /// Begin profiling with the given sampling frequency.
    ///
    /// Creates a ring buffer, starts the CPU sampler, and opens a WebSocket
    /// transport to the configured backend.
    public static func startProfiling(samplingHz: Int = 100) {
        guard ringBuffer == nil else { return }

        guard let rb = ios_ring_buffer_create(8192) else { return }
        ringBuffer = rb

        ios_cpu_sampler_start(rb, Int32(samplingHz))

        host.withCString { hostPtr in
            _ = ios_transport_start(rb, hostPtr, Int32(port))
        }
    }

    /// Stop profiling and tear down all resources.
    public static func stopProfiling() {
        guard let rb = ringBuffer else { return }

        ios_cpu_sampler_stop()
        ios_transport_stop()
        ios_ring_buffer_destroy(rb)
        ringBuffer = nil
    }

    /// Emit a signpost event into the profiling stream.
    ///
    /// - Parameters:
    ///   - type: Whether this is a begin, end, or point event.
    ///   - name: A human-readable label (truncated to 255 characters).
    ///   - id: An optional correlation identifier for matching begin/end pairs.
    public static func signpost(_ type: SignpostType, name: String, id: UInt64 = 0) {
        guard let rb = ringBuffer else { return }

        var event = ios_event_t()
        event.type = IOS_EVENT_SIGNPOST
        event.timestamp_ns = mach_absolute_time()

        switch type {
        case .begin: event.signpost.event = IOS_SIGNPOST_BEGIN
        case .end:   event.signpost.event = IOS_SIGNPOST_END
        case .event: event.signpost.event = IOS_SIGNPOST_EVENT
        }

        event.signpost.signpost_id = id

        // Copy name into the fixed-size buffer
        name.withCString { src in
            withUnsafeMutablePointer(to: &event.signpost.name) { dst in
                let bound = dst.withMemoryRebound(to: Int8.self, capacity: Int(IOS_MAX_NAME_LENGTH)) { buf in
                    return buf
                }
                strncpy(bound, src, Int(IOS_MAX_NAME_LENGTH) - 1)
                bound[Int(IOS_MAX_NAME_LENGTH) - 1] = 0
            }
        }

        _ = ios_ring_buffer_write(rb, &event)
    }
}
