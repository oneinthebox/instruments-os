# InstrumentsOS

An open-source iOS performance profiler inspired by Apple Instruments and Google Perfetto.

## Architecture

```
┌─────────────┐     WebSocket     ┌─────────────┐     REST API     ┌─────────────┐
│   iOS SDK   │ ──────────────▶  │   Backend   │ ──────────────▶  │  Web Viewer  │
│  (C/ObjC)   │    WiFi/JSON     │  (Python)   │                  │ (React+Canvas)│
└─────────────┘                  └─────────────┘                  └─────────────┘
```

Three layers:
1. **SDK** — embeds in your iOS app, collects CPU samples, memory stats, UI hitches, signposts
2. **Backend** — receives trace data, symbolizes addresses, stores in SQLite, serves REST API
3. **Viewer** — browser-based multi-track timeline with flame charts, call trees, detail panels

## Quick Start

### Prerequisites
- macOS with Xcode 16+
- Python 3.11+
- Node.js 20+
- An iOS device or simulator

### 1. Start the backend
```bash
cd backend
pip install -r requirements.txt
python server.py
# Listening on ws://0.0.0.0:8765, http://0.0.0.0:8080
```

### 2. Start the viewer
```bash
cd viewer
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Add SDK to your iOS app

In your `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/oneinthebox/instruments-os", from: "0.1.0")
]
```

Or add `ios/sdk/` as a local package in Xcode.

In your app:
```swift
import InstrumentsOS

@main
struct MyApp: App {
    init() {
        InstrumentsOS.configure(host: "YOUR_MAC_IP", port: 8765)
        InstrumentsOS.startProfiling()
    }
    // ...
}
```

### 4. Run the demo app (optional)
```bash
cd demo
open BuggyApp.xcodeproj
# Build and run on simulator or device
# The viewer will show live profiling data
```

## Directory Structure

```
ios/
├── sdk/              # iOS SDK (Swift Package)
│   ├── InstrumentsOS/
│   │   ├── Core/     # C — ring buffer, CPU sampler, memory tracker
│   │   ├── Transport/ # ObjC — WebSocket client
│   │   └── Swift/    # Swift — public API wrapper
│   └── Package.swift
├── backend/          # Python trace server
│   ├── server.py     # WebSocket + REST server
│   ├── processor.py  # Trace event processing
│   ├── symbolizer.py # atos-based symbolication
│   └── store.py      # SQLite trace storage
├── viewer/           # Web-based trace viewer
│   └── src/
│       ├── components/ # Timeline, FlameChart, CallTree
│       └── canvas/     # Canvas 2D rendering engine
└── demo/             # BuggyApp — deliberately buggy demo
    └── BuggyApp/
```

## What It Profiles

| Track | Data Source | What It Shows |
|-------|-----------|--------------|
| CPU | Mach thread suspension + stack walking | Per-thread CPU usage, flame charts |
| Memory | malloc zone interposition | Live bytes, allocation rate, peak |
| Hitches | CADisplayLink timing | Missed frames, severity classification |
| Signposts | os_signpost bridge | Developer-placed operation intervals |

## How It Works

1. **SDK** spawns a sampling thread that pauses app threads 100x/sec via `thread_suspend()`
2. Reads register state via `thread_get_state()`, walks frame pointer chain for call stack
3. Events written to a lock-free ring buffer, drained to host Mac via WebSocket
4. **Backend** symbolizes addresses using `atos`, stores in SQLite
5. **Viewer** renders a multi-track Canvas timeline with pan/zoom

## License

MIT
