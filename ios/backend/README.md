# InstrumentsOS Backend

Python server that receives trace data from the iOS SDK, processes it, and serves it to the web viewer.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
python server.py
```

This starts:
- **WebSocket server** on `ws://0.0.0.0:8765` (receives SDK events)
- **REST API** on `http://0.0.0.0:8080` (serves data to viewer)

## Symbolication

To get function names instead of raw addresses, provide the path to your app's dSYM:

```bash
python server.py --dsym /path/to/MyApp.app.dSYM
```

The symbolizer uses Apple's `atos` tool under the hood. Results are cached in SQLite.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all recorded sessions |
| `/api/traces/:id/timeline` | GET | Events in time range (`?start=&end=` in ns) |
| `/api/traces/:id/flamechart` | GET | Aggregated stacks for flame chart |
| `/api/traces/:id/calltree` | GET | Call tree (top-down/bottom-up) |
| `/ws/live` | WebSocket | Live event streaming to viewer |

## Storage

Traces are stored in `traces.db` (SQLite) in the current directory. Tables:
- `sessions` — recording metadata (start time, device, app name)
- `events` — all trace events (indexed by timestamp)
- `stacks` — deduplicated stack frames
- `symbols` — address-to-name cache from symbolication
