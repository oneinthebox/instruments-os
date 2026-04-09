# BuggyApp — InstrumentsOS Demo

A deliberately buggy SwiftUI iOS app for demonstrating InstrumentsOS profiling.

## Building

```bash
open BuggyApp.xcodeproj
# Or: xcodebuild -scheme BuggyApp -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Running

1. Start the InstrumentsOS backend: `cd ../backend && python server.py`
2. Start the viewer: `cd ../viewer && npm run dev`
3. Build and run BuggyApp on a simulator or device
4. Open `http://localhost:5173` to see the profiling data

## Bugs (by design)

Each bug demonstrates a different type of performance issue visible in the InstrumentsOS viewer:

| Bug | Class | What It Does | Visible In |
|-----|-------|-------------|-----------|
| Main thread blocking | `MainThreadBlocker` | Synchronous URLSession on main thread | CPU track (100% main), Hitch track (severe hang) |
| Memory leak | `MemoryLeaker` | Timer with strong self reference in closure | Memory track (unbounded growth) |
| UI hitches | `HitchGenerator` | CIFilter processing inside ScrollView body | Hitch track (repeated frame drops) |
| Network spam | `NetworkSpammer` | 100 concurrent URLSession requests | Signpost track (overlapping intervals) |

## Navigation

The app has a tab bar with four tabs, one for each bug type. Tap a tab, trigger the action, and watch the viewer light up.
