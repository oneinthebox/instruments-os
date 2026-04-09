# InstrumentsOS SDK

Lightweight iOS profiling SDK. Embeds in your app, collects performance data, streams to the InstrumentsOS backend.

## Building

### As a Swift Package (recommended)

Add as a local package in Xcode:
1. File > Add Package Dependencies
2. Select "Add Local..." and point to this `sdk/` directory

Or reference in `Package.swift`:
```swift
.package(path: "../ios/sdk")
```

### From source

```bash
# Build the framework
cd sdk
swift build

# Run tests
swift test
```

## Usage

```swift
import InstrumentsOS

// Configure and start
InstrumentsOS.configure(host: "192.168.1.5", port: 8765)
InstrumentsOS.startProfiling()

// Optional: custom signposts
InstrumentsOS.signpost(.begin, name: "data-load", id: requestId)
// ... your code ...
InstrumentsOS.signpost(.end, name: "data-load", id: requestId)

// Stop when done
InstrumentsOS.stopProfiling()
```

## Components

| Component | Language | Purpose |
|-----------|----------|---------|
| `Core/IOSCPUSampler` | C | 100Hz call stack sampling via Mach APIs |
| `Core/IOSRingBuffer` | C | Lock-free SPSC circular buffer |
| `Core/IOSMemoryTracker` | C | malloc/free tracking via zone interposition |
| `Core/IOSHitchDetector` | ObjC | CADisplayLink frame timing monitor |
| `Core/IOSSignpostBridge` | ObjC | os_signpost event observer |
| `Transport/IOSTransport` | ObjC | WebSocket client (streams to backend) |
| `Swift/InstrumentsOS` | Swift | Public API facade |

## Overhead

Target: < 5% CPU, < 10MB memory on the profiled app.

- CPU sampler: ~2-3% (100Hz sampling + stack walking)
- Ring buffer: ~4MB default (configurable)
- Transport: ~1-2% (JSON serialization + WebSocket I/O)
- Hitch detector: negligible (one CADisplayLink callback)
