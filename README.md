# instruments-os

Open-source performance profiling for iOS — inspired by Apple Instruments and Google Perfetto.

## What is this?

InstrumentsOS is a three-part system for profiling iOS apps:

1. **SDK** (C/ObjC/Swift) — embeds in your app, samples CPU, tracks memory, detects UI hitches
2. **Backend** (Python) — receives data, symbolizes addresses, stores traces
3. **Viewer** (React + Canvas) — browser-based multi-track timeline with flame charts

Plus a **learning app** to understand profiling from the ground up.

## Project Structure

```
instruments-os/
├── ios/                # The profiler
│   ├── sdk/            # iOS SDK (Swift Package)
│   ├── backend/        # Python trace server
│   ├── viewer/         # Web-based trace viewer
│   └── demo/           # BuggyApp (demo with deliberate perf bugs)
├── learn/              # Interactive learning app (React)
│   └── src/            # 5 modules, 26 lessons, 40 quiz questions
└── docs/               # Design specs
```

See each directory's README for build and run instructions.

## Quick Start

### Learn profiling concepts
```bash
cd learn && npm install && npm run dev
```

### Run the profiler
```bash
# Terminal 1: backend
cd ios/backend && pip install -r requirements.txt && python server.py

# Terminal 2: viewer
cd ios/viewer && npm install && npm run dev

# Terminal 3: run your iOS app with the SDK embedded
```

## License

MIT
