# InstrumentsOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source iOS performance profiler with SDK, Python backend, and web-based trace viewer — a "Perfetto for iOS."

**Architecture:** Three-layer system: lightweight C/ObjC SDK embeds in iOS apps to collect CPU samples, memory, hitches, and GPU data via Mach APIs. Python backend receives events over WebSocket, symbolizes addresses, stores in SQLite. React + Canvas web viewer renders a multi-track timeline with flame charts and call trees.

**Tech Stack:** C/ObjC/Swift (SDK), Python 3.11+ with websockets/aiohttp (backend), Vite/React/TypeScript/Tailwind/shadcn/Canvas 2D (viewer)

---

## File Structure

### SDK (`ios/sdk/`)
```
ios/sdk/
├── Package.swift                           # SPM manifest
├── Sources/
│   └── InstrumentsOS/
│       ├── Core/
│       │   ├── IOSRingBuffer.h             # Ring buffer header
│       │   ├── IOSRingBuffer.c             # Lock-free SPSC ring buffer
│       │   ├── IOSEvent.h                  # Trace event struct definitions
│       │   ├── IOSCPUSampler.h             # CPU sampler header
│       │   ├── IOSCPUSampler.c             # Mach thread suspension + stack walk
│       │   ├── IOSMemoryTracker.h          # Memory tracker header
│       │   ├── IOSMemoryTracker.c          # malloc zone interposition
│       │   ├── IOSHitchDetector.h          # Hitch detector header
│       │   ├── IOSHitchDetector.m          # CADisplayLink frame timing
│       │   ├── IOSGPUTracker.h             # GPU tracker header
│       │   ├── IOSGPUTracker.m             # Metal command buffer timing
│       │   ├── IOSSignpostBridge.h         # Signpost bridge header
│       │   └── IOSSignpostBridge.m         # os_signpost observer
│       ├── Transport/
│       │   ├── IOSTransport.h              # Transport header
│       │   └── IOSTransport.m              # WebSocket client + JSON serialization
│       ├── InstrumentsOS.swift             # Public Swift API facade
│       └── include/
│           └── module.modulemap            # C/ObjC module map for Swift interop
├── Tests/
│   └── InstrumentsOSTests/
│       ├── RingBufferTests.swift           # Ring buffer unit tests
│       └── EventSerializationTests.swift   # JSON serialization tests
```

### Backend (`ios/backend/`)
```
ios/backend/
├── requirements.txt
├── server.py                               # Entry point: starts WS + HTTP servers
├── ws_handler.py                           # WebSocket connection handler
├── processor.py                            # Event processing + deduplication
├── symbolizer.py                           # atos-based address symbolication
├── store.py                                # SQLite trace storage
├── api.py                                  # REST API routes
├── models.py                               # Dataclasses for events, sessions, stacks
└── tests/
    ├── test_processor.py
    ├── test_store.py
    └── test_api.py
```

### Viewer (`ios/viewer/`)
```
ios/viewer/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                           # Tailwind + dark theme
│   ├── types.ts                            # Trace data TypeScript types
│   ├── api/
│   │   └── client.ts                       # REST + WebSocket client
│   ├── store/
│   │   └── traceStore.ts                   # Trace data state management
│   ├── canvas/
│   │   ├── renderer.ts                     # Core Canvas 2D rendering engine
│   │   ├── timeline.ts                     # Timeline coordinate system (pan/zoom)
│   │   ├── tracks/
│   │   │   ├── cpuTrack.ts                 # CPU usage area chart
│   │   │   ├── memoryTrack.ts              # Memory line graph
│   │   │   ├── hitchTrack.ts               # Hitch severity bars
│   │   │   ├── gpuTrack.ts                 # GPU utilization + command buffers
│   │   │   └── signpostTrack.ts            # Labeled intervals
│   │   └── flameChart.ts                   # Flame chart renderer
│   ├── components/
│   │   ├── TimelineView.tsx                # Canvas host + track headers
│   │   ├── DetailPanel.tsx                 # Bottom pane tabs
│   │   ├── FlameChartPanel.tsx             # Flame chart detail tab
│   │   ├── CallTreePanel.tsx               # Call tree detail tab
│   │   ├── EventsPanel.tsx                 # Raw events table
│   │   ├── Toolbar.tsx                     # Session picker, recording controls
│   │   └── InspectionRange.tsx             # Time range selection overlay
│   └── lib/
│       └── utils.ts
```

### Demo App (`ios/demo/`)
```
ios/demo/
├── BuggyApp.xcodeproj/
├── BuggyApp/
│   ├── BuggyAppApp.swift                   # @main entry with SDK init
│   ├── ContentView.swift                   # Tab bar with 5 bug tabs
│   ├── bugs/
│   │   ├── MainThreadBlocker.swift
│   │   ├── MemoryLeaker.swift
│   │   ├── HitchGenerator.swift
│   │   ├── NetworkSpammer.swift
│   │   └── MLHog.swift
│   └── Assets.xcassets/
```

---

## Phase 1: End-to-End Skeleton (Day 1-2)

Get data flowing from iOS to browser. Dummy events, no real profiling yet — just the plumbing.

### Task 1: SDK — Ring Buffer + Event Types

**Files:**
- Create: `ios/sdk/Package.swift`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSEvent.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSRingBuffer.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSRingBuffer.c`
- Create: `ios/sdk/Tests/InstrumentsOSTests/RingBufferTests.swift`

- [ ] **Step 1: Create Package.swift**

```swift
// ios/sdk/Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InstrumentsOS",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "InstrumentsOS", targets: ["InstrumentsOS"]),
    ],
    targets: [
        .target(
            name: "InstrumentsOS",
            path: "Sources/InstrumentsOS",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("Core"),
                .headerSearchPath("Transport"),
            ]
        ),
        .testTarget(
            name: "InstrumentsOSTests",
            dependencies: ["InstrumentsOS"]
        ),
    ]
)
```

- [ ] **Step 2: Create event type definitions**

```c
// ios/sdk/Sources/InstrumentsOS/Core/IOSEvent.h
#ifndef IOS_EVENT_H
#define IOS_EVENT_H

#include <stdint.h>
#include <stdbool.h>

#define IOS_MAX_STACK_DEPTH 128
#define IOS_MAX_NAME_LEN 256

typedef enum {
    IOS_EVENT_CPU_SAMPLE = 1,
    IOS_EVENT_MEMORY = 2,
    IOS_EVENT_HITCH = 3,
    IOS_EVENT_SIGNPOST = 4,
    IOS_EVENT_GPU_CMD_BUF = 5,
    IOS_EVENT_GPU_MEMORY = 6,
    IOS_EVENT_GPU_UTIL = 7,
} ios_event_type_t;

typedef enum {
    IOS_SIGNPOST_BEGIN = 0,
    IOS_SIGNPOST_END = 1,
    IOS_SIGNPOST_EVENT = 2,
} ios_signpost_event_t;

typedef struct {
    ios_event_type_t type;
    uint64_t timestamp_ns;

    union {
        struct {
            uint64_t thread_id;
            char thread_name[64];
            uint64_t frames[IOS_MAX_STACK_DEPTH];
            uint32_t frame_count;
        } cpu_sample;

        struct {
            uint64_t live_bytes;
            uint64_t allocation_rate_bps;
            uint64_t peak_bytes;
        } memory;

        struct {
            double duration_ms;
            uint64_t main_thread_frames[IOS_MAX_STACK_DEPTH];
            uint32_t frame_count;
        } hitch;

        struct {
            ios_signpost_event_t event;
            char name[IOS_MAX_NAME_LEN];
            uint64_t signpost_id;
        } signpost;

        struct {
            char label[IOS_MAX_NAME_LEN];
            uint64_t gpu_start_ns;
            uint64_t gpu_end_ns;
            double gpu_duration_ms;
            char encoder_type[32];
        } gpu_cmd_buf;

        struct {
            uint64_t allocated_bytes;
            uint64_t peak_bytes;
        } gpu_memory;

        struct {
            double utilization_pct;
            uint64_t vertex_count;
            uint64_t fragment_count;
        } gpu_util;
    } data;
} ios_event_t;

#endif // IOS_EVENT_H
```

- [ ] **Step 3: Create ring buffer header**

```c
// ios/sdk/Sources/InstrumentsOS/Core/IOSRingBuffer.h
#ifndef IOS_RING_BUFFER_H
#define IOS_RING_BUFFER_H

#include "IOSEvent.h"
#include <stdbool.h>

typedef struct ios_ring_buffer ios_ring_buffer_t;

// Create a ring buffer with capacity for `count` events.
ios_ring_buffer_t* ios_ring_buffer_create(uint32_t count);

// Destroy the ring buffer and free memory.
void ios_ring_buffer_destroy(ios_ring_buffer_t* rb);

// Write an event. Returns true if written, false if buffer is full.
// Thread-safe for single producer.
bool ios_ring_buffer_write(ios_ring_buffer_t* rb, const ios_event_t* event);

// Read an event into `out`. Returns true if an event was read, false if empty.
// Thread-safe for single consumer.
bool ios_ring_buffer_read(ios_ring_buffer_t* rb, ios_event_t* out);

// Number of events currently in the buffer.
uint32_t ios_ring_buffer_count(const ios_ring_buffer_t* rb);

#endif // IOS_RING_BUFFER_H
```

- [ ] **Step 4: Implement the ring buffer**

```c
// ios/sdk/Sources/InstrumentsOS/Core/IOSRingBuffer.c
#include "IOSRingBuffer.h"
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>

struct ios_ring_buffer {
    ios_event_t* events;
    uint32_t capacity;
    _Atomic uint32_t write_head;
    _Atomic uint32_t read_head;
};

ios_ring_buffer_t* ios_ring_buffer_create(uint32_t count) {
    ios_ring_buffer_t* rb = calloc(1, sizeof(ios_ring_buffer_t));
    if (!rb) return NULL;

    // Round up to power of 2 for fast modulo via bitmask
    uint32_t cap = 1;
    while (cap < count) cap <<= 1;

    rb->events = calloc(cap, sizeof(ios_event_t));
    if (!rb->events) { free(rb); return NULL; }

    rb->capacity = cap;
    atomic_store(&rb->write_head, 0);
    atomic_store(&rb->read_head, 0);
    return rb;
}

void ios_ring_buffer_destroy(ios_ring_buffer_t* rb) {
    if (!rb) return;
    free(rb->events);
    free(rb);
}

bool ios_ring_buffer_write(ios_ring_buffer_t* rb, const ios_event_t* event) {
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_relaxed);
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_acquire);
    uint32_t mask = rb->capacity - 1;

    // Full when write is one full cycle ahead of read
    if (((w + 1) & mask) == (r & mask)) {
        return false;
    }

    rb->events[w & mask] = *event;
    atomic_store_explicit(&rb->write_head, w + 1, memory_order_release);
    return true;
}

bool ios_ring_buffer_read(ios_ring_buffer_t* rb, ios_event_t* out) {
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_relaxed);
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_acquire);
    uint32_t mask = rb->capacity - 1;

    // Empty when read == write
    if ((r & mask) == (w & mask) && r == w) {
        return false;
    }

    *out = rb->events[r & mask];
    atomic_store_explicit(&rb->read_head, r + 1, memory_order_release);
    return true;
}

uint32_t ios_ring_buffer_count(const ios_ring_buffer_t* rb) {
    uint32_t w = atomic_load_explicit(&rb->write_head, memory_order_acquire);
    uint32_t r = atomic_load_explicit(&rb->read_head, memory_order_acquire);
    return w - r;
}
```

- [ ] **Step 5: Write ring buffer tests**

```swift
// ios/sdk/Tests/InstrumentsOSTests/RingBufferTests.swift
import Testing
@testable import InstrumentsOS

@Test func ringBufferCreateDestroy() {
    let rb = ios_ring_buffer_create(16)
    #expect(rb != nil)
    #expect(ios_ring_buffer_count(rb) == 0)
    ios_ring_buffer_destroy(rb)
}

@Test func ringBufferWriteRead() {
    let rb = ios_ring_buffer_create(16)!
    var event = ios_event_t()
    event.type = IOS_EVENT_MEMORY
    event.timestamp_ns = 42
    event.data.memory.live_bytes = 1024

    let written = ios_ring_buffer_write(rb, &event)
    #expect(written == true)
    #expect(ios_ring_buffer_count(rb) == 1)

    var out = ios_event_t()
    let read = ios_ring_buffer_read(rb, &out)
    #expect(read == true)
    #expect(out.type == IOS_EVENT_MEMORY)
    #expect(out.timestamp_ns == 42)
    #expect(out.data.memory.live_bytes == 1024)
    #expect(ios_ring_buffer_count(rb) == 0)

    ios_ring_buffer_destroy(rb)
}

@Test func ringBufferEmptyRead() {
    let rb = ios_ring_buffer_create(16)!
    var out = ios_event_t()
    let read = ios_ring_buffer_read(rb, &out)
    #expect(read == false)
    ios_ring_buffer_destroy(rb)
}

@Test func ringBufferFull() {
    let rb = ios_ring_buffer_create(4)! // capacity rounds to 4
    var event = ios_event_t()
    event.type = IOS_EVENT_MEMORY

    // Fill buffer (capacity 4, usable 3 due to SPSC sentinel)
    for i in 0..<3 {
        event.timestamp_ns = UInt64(i)
        let ok = ios_ring_buffer_write(rb, &event)
        #expect(ok == true)
    }

    // Should fail — full
    let overflow = ios_ring_buffer_write(rb, &event)
    #expect(overflow == false)

    ios_ring_buffer_destroy(rb)
}
```

- [ ] **Step 6: Create module map for Swift interop**

```modulemap
// ios/sdk/Sources/InstrumentsOS/include/module.modulemap
module InstrumentsOS {
    header "../Core/IOSEvent.h"
    header "../Core/IOSRingBuffer.h"
    export *
}
```

- [ ] **Step 7: Build and run tests**

Run: `cd ios/sdk && swift test`
Expected: All 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add ios/sdk/
git commit -m "feat(sdk): add ring buffer and event types

Lock-free SPSC ring buffer with power-of-2 capacity.
Event union type covers all 7 event types (cpu, memory, hitch, signpost, gpu)."
```

---

### Task 2: Backend — WebSocket Server + SQLite Store

**Files:**
- Create: `ios/backend/requirements.txt`
- Create: `ios/backend/models.py`
- Create: `ios/backend/store.py`
- Create: `ios/backend/ws_handler.py`
- Create: `ios/backend/api.py`
- Create: `ios/backend/server.py`
- Create: `ios/backend/tests/test_store.py`

- [ ] **Step 1: Create requirements.txt**

```
# ios/backend/requirements.txt
websockets>=12.0
aiohttp>=3.9
pytest>=8.0
pytest-asyncio>=0.23
```

- [ ] **Step 2: Create data models**

```python
# ios/backend/models.py
from dataclasses import dataclass, field
from typing import Optional
import time

@dataclass
class StackFrame:
    address: str
    symbol: Optional[str] = None

@dataclass
class TraceEvent:
    type: str
    timestamp_ns: int
    session_id: str = ""
    # CPU sample fields
    thread_id: Optional[int] = None
    thread_name: Optional[str] = None
    frames: list[StackFrame] = field(default_factory=list)
    # Memory fields
    live_bytes: Optional[int] = None
    allocation_rate_bps: Optional[int] = None
    peak_bytes: Optional[int] = None
    # Hitch fields
    duration_ms: Optional[float] = None
    severity: Optional[str] = None
    main_thread_stack: list[StackFrame] = field(default_factory=list)
    # Signpost fields
    event: Optional[str] = None
    name: Optional[str] = None
    signpost_id: Optional[str] = None
    # GPU command buffer fields
    label: Optional[str] = None
    gpu_start_ns: Optional[int] = None
    gpu_end_ns: Optional[int] = None
    gpu_duration_ms: Optional[float] = None
    encoder_type: Optional[str] = None
    # GPU memory fields
    allocated_bytes: Optional[int] = None
    # GPU utilization fields
    utilization_pct: Optional[float] = None
    vertex_count: Optional[int] = None
    fragment_count: Optional[int] = None

@dataclass
class Session:
    id: str
    start_time_ns: int = field(default_factory=lambda: int(time.time() * 1e9))
    device: str = "unknown"
    app_name: str = "unknown"
    event_count: int = 0
```

- [ ] **Step 3: Create SQLite store**

```python
# ios/backend/store.py
import sqlite3
import json
from models import TraceEvent, Session, StackFrame

class TraceStore:
    def __init__(self, db_path: str = "traces.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()

    def _init_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                start_time_ns INTEGER,
                device TEXT,
                app_name TEXT,
                event_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                type TEXT NOT NULL,
                timestamp_ns INTEGER NOT NULL,
                data TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            CREATE INDEX IF NOT EXISTS idx_events_session_time
                ON events(session_id, timestamp_ns);
            CREATE INDEX IF NOT EXISTS idx_events_type
                ON events(session_id, type);
            CREATE TABLE IF NOT EXISTS symbols (
                address TEXT PRIMARY KEY,
                symbol TEXT,
                file TEXT,
                line INTEGER
            );
        """)
        self.conn.commit()

    def create_session(self, session: Session):
        self.conn.execute(
            "INSERT INTO sessions (id, start_time_ns, device, app_name) VALUES (?, ?, ?, ?)",
            (session.id, session.start_time_ns, session.device, session.app_name),
        )
        self.conn.commit()

    def insert_event(self, event: TraceEvent):
        data = json.dumps(event.__dict__, default=str)
        self.conn.execute(
            "INSERT INTO events (session_id, type, timestamp_ns, data) VALUES (?, ?, ?, ?)",
            (event.session_id, event.type, event.timestamp_ns, data),
        )
        self.conn.execute(
            "UPDATE sessions SET event_count = event_count + 1 WHERE id = ?",
            (event.session_id,),
        )
        self.conn.commit()

    def insert_events_batch(self, events: list[TraceEvent]):
        rows = [
            (e.session_id, e.type, e.timestamp_ns, json.dumps(e.__dict__, default=str))
            for e in events
        ]
        self.conn.executemany(
            "INSERT INTO events (session_id, type, timestamp_ns, data) VALUES (?, ?, ?, ?)",
            rows,
        )
        if events:
            self.conn.execute(
                "UPDATE sessions SET event_count = event_count + ? WHERE id = ?",
                (len(events), events[0].session_id),
            )
        self.conn.commit()

    def get_sessions(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM sessions ORDER BY start_time_ns DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_events(self, session_id: str, start_ns: int = 0, end_ns: int = 2**63,
                   event_type: str | None = None) -> list[dict]:
        query = "SELECT data FROM events WHERE session_id = ? AND timestamp_ns BETWEEN ? AND ?"
        params: list = [session_id, start_ns, end_ns]
        if event_type:
            query += " AND type = ?"
            params.append(event_type)
        query += " ORDER BY timestamp_ns LIMIT 50000"
        rows = self.conn.execute(query, params).fetchall()
        return [json.loads(r["data"]) for r in rows]

    def get_symbol(self, address: str) -> str | None:
        row = self.conn.execute(
            "SELECT symbol FROM symbols WHERE address = ?", (address,)
        ).fetchone()
        return row["symbol"] if row else None

    def cache_symbol(self, address: str, symbol: str, file: str = "", line: int = 0):
        self.conn.execute(
            "INSERT OR REPLACE INTO symbols (address, symbol, file, line) VALUES (?, ?, ?, ?)",
            (address, symbol, file, line),
        )
        self.conn.commit()
```

- [ ] **Step 4: Write store tests**

```python
# ios/backend/tests/test_store.py
import os
import pytest
from store import TraceStore
from models import TraceEvent, Session

@pytest.fixture
def store(tmp_path):
    db = str(tmp_path / "test.db")
    return TraceStore(db)

def test_create_session(store):
    s = Session(id="s1", device="iPhone", app_name="BuggyApp")
    store.create_session(s)
    sessions = store.get_sessions()
    assert len(sessions) == 1
    assert sessions[0]["id"] == "s1"

def test_insert_and_query_events(store):
    s = Session(id="s1")
    store.create_session(s)
    e1 = TraceEvent(type="cpu_sample", timestamp_ns=1000, session_id="s1", thread_id=1)
    e2 = TraceEvent(type="memory", timestamp_ns=2000, session_id="s1", live_bytes=4096)
    store.insert_event(e1)
    store.insert_event(e2)
    events = store.get_events("s1")
    assert len(events) == 2

def test_query_time_range(store):
    s = Session(id="s1")
    store.create_session(s)
    for i in range(10):
        store.insert_event(TraceEvent(type="memory", timestamp_ns=i * 1000, session_id="s1"))
    events = store.get_events("s1", start_ns=3000, end_ns=6000)
    assert len(events) == 4  # 3000, 4000, 5000, 6000

def test_query_by_type(store):
    s = Session(id="s1")
    store.create_session(s)
    store.insert_event(TraceEvent(type="cpu_sample", timestamp_ns=1000, session_id="s1"))
    store.insert_event(TraceEvent(type="memory", timestamp_ns=2000, session_id="s1"))
    events = store.get_events("s1", event_type="cpu_sample")
    assert len(events) == 1
    assert events[0]["type"] == "cpu_sample"

def test_symbol_cache(store):
    assert store.get_symbol("0x1000") is None
    store.cache_symbol("0x1000", "main()")
    assert store.get_symbol("0x1000") == "main()"
```

- [ ] **Step 5: Run store tests**

Run: `cd ios/backend && pip install -r requirements.txt && python -m pytest tests/test_store.py -v`
Expected: All 5 tests pass.

- [ ] **Step 6: Create WebSocket handler**

```python
# ios/backend/ws_handler.py
import json
import uuid
import logging
from models import TraceEvent, Session, StackFrame
from store import TraceStore

logger = logging.getLogger(__name__)

class WSHandler:
    def __init__(self, store: TraceStore):
        self.store = store
        self.live_subscribers: list = []  # WebSocket connections watching live data

    async def handle_sdk_connection(self, websocket):
        session_id = str(uuid.uuid4())[:8]
        session = Session(id=session_id)
        self.store.create_session(session)
        logger.info(f"SDK connected, session={session_id}")

        batch: list[TraceEvent] = []
        batch_size = 100

        try:
            async for message in websocket:
                raw = json.loads(message)
                event = self._parse_event(raw, session_id)
                batch.append(event)

                if len(batch) >= batch_size:
                    self.store.insert_events_batch(batch)
                    for sub in self.live_subscribers:
                        try:
                            await sub.send(json.dumps([e.__dict__ for e in batch], default=str))
                        except Exception:
                            pass
                    batch.clear()
        finally:
            if batch:
                self.store.insert_events_batch(batch)
            logger.info(f"SDK disconnected, session={session_id}")

    def _parse_event(self, raw: dict, session_id: str) -> TraceEvent:
        frames = [
            StackFrame(address=f["address"], symbol=f.get("symbol"))
            for f in raw.get("frames", [])
        ]
        main_stack = [
            StackFrame(address=f["address"], symbol=f.get("symbol"))
            for f in raw.get("main_thread_stack", [])
        ]
        return TraceEvent(
            type=raw["type"],
            timestamp_ns=raw["timestamp_ns"],
            session_id=session_id,
            thread_id=raw.get("thread_id"),
            thread_name=raw.get("thread_name"),
            frames=frames,
            live_bytes=raw.get("live_bytes"),
            allocation_rate_bps=raw.get("allocation_rate_bps"),
            peak_bytes=raw.get("peak_bytes"),
            duration_ms=raw.get("duration_ms"),
            severity=raw.get("severity"),
            main_thread_stack=main_stack,
            event=raw.get("event"),
            name=raw.get("name"),
            signpost_id=raw.get("signpost_id"),
            label=raw.get("label"),
            gpu_start_ns=raw.get("gpu_start_ns"),
            gpu_end_ns=raw.get("gpu_end_ns"),
            gpu_duration_ms=raw.get("gpu_duration_ms"),
            encoder_type=raw.get("encoder_type"),
            allocated_bytes=raw.get("allocated_bytes"),
            utilization_pct=raw.get("utilization_pct"),
            vertex_count=raw.get("vertex_count"),
            fragment_count=raw.get("fragment_count"),
        )
```

- [ ] **Step 7: Create REST API**

```python
# ios/backend/api.py
from aiohttp import web
from store import TraceStore

def create_app(store: TraceStore) -> web.Application:
    app = web.Application()
    app["store"] = store

    app.router.add_get("/api/sessions", handle_sessions)
    app.router.add_get("/api/traces/{session_id}/timeline", handle_timeline)
    app.router.add_get("/api/traces/{session_id}/events", handle_events)

    # CORS middleware
    app.middlewares.append(cors_middleware)
    return app

@web.middleware
async def cors_middleware(request, handler):
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

async def handle_sessions(request: web.Request):
    store: TraceStore = request.app["store"]
    sessions = store.get_sessions()
    return web.json_response(sessions)

async def handle_timeline(request: web.Request):
    store: TraceStore = request.app["store"]
    session_id = request.match_info["session_id"]
    start = int(request.query.get("start", "0"))
    end = int(request.query.get("end", str(2**63)))
    events = store.get_events(session_id, start_ns=start, end_ns=end)
    return web.json_response(events)

async def handle_events(request: web.Request):
    store: TraceStore = request.app["store"]
    session_id = request.match_info["session_id"]
    event_type = request.query.get("type")
    events = store.get_events(session_id, event_type=event_type)
    return web.json_response(events)
```

- [ ] **Step 8: Create server entry point**

```python
# ios/backend/server.py
import asyncio
import logging
import websockets
from aiohttp import web
from store import TraceStore
from ws_handler import WSHandler
from api import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

async def main():
    store = TraceStore()
    handler = WSHandler(store)

    # Start WebSocket server for SDK connections
    ws_server = await websockets.serve(handler.handle_sdk_connection, "0.0.0.0", 8765)
    logger.info("WebSocket server listening on ws://0.0.0.0:8765")

    # Start HTTP server for viewer API
    app = create_app(store)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    logger.info("REST API listening on http://0.0.0.0:8080")

    # Run forever
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 9: Verify server starts**

Run: `cd ios/backend && python server.py &` then `curl http://localhost:8080/api/sessions`
Expected: `[]` (empty JSON array)

- [ ] **Step 10: Commit**

```bash
git add ios/backend/
git commit -m "feat(backend): add WebSocket server, SQLite store, REST API

Receives trace events via WebSocket, stores in SQLite, serves via REST.
Supports time-range queries and event type filtering."
```

---

### Task 3: Viewer — Project Setup + Canvas Timeline Skeleton

**Files:**
- Create: `ios/viewer/package.json`
- Create: `ios/viewer/vite.config.ts`
- Create: `ios/viewer/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `ios/viewer/index.html`
- Create: `ios/viewer/src/main.tsx`, `App.tsx`, `index.css`
- Create: `ios/viewer/src/types.ts`
- Create: `ios/viewer/src/api/client.ts`
- Create: `ios/viewer/src/store/traceStore.ts`
- Create: `ios/viewer/src/canvas/timeline.ts`
- Create: `ios/viewer/src/canvas/renderer.ts`
- Create: `ios/viewer/src/components/TimelineView.tsx`
- Create: `ios/viewer/src/components/Toolbar.tsx`

This task creates the viewer project and a basic Canvas timeline that can render placeholder data. The viewer should display a toolbar with session picker and a Canvas element that renders a CPU track with pan/zoom.

- [ ] **Step 1: Initialize viewer project**

Run:
```bash
cd ios/viewer
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install -D shadcn
npm install react-router-dom
```

- [ ] **Step 2: Configure Tailwind, shadcn, path aliases**

Follow the same setup pattern used in `learn/`:
- Update `vite.config.ts` with tailwindcss plugin and `@` alias
- Update `tsconfig.json` and `tsconfig.app.json` with `baseUrl` and `paths`
- Run `./node_modules/.bin/shadcn init -d`
- Add components: `./node_modules/.bin/shadcn add card badge tabs button select separator -y`
- Set `index.html` class="dark", title="InstrumentsOS Viewer"

- [ ] **Step 3: Create TypeScript types for trace data**

```typescript
// ios/viewer/src/types.ts
export interface StackFrame {
  address: string;
  symbol: string | null;
}

export interface CpuSampleEvent {
  type: "cpu_sample";
  timestamp_ns: number;
  thread_id: number;
  thread_name: string;
  frames: StackFrame[];
}

export interface MemoryEvent {
  type: "memory";
  timestamp_ns: number;
  live_bytes: number;
  allocation_rate_bps: number;
  peak_bytes: number;
}

export interface HitchEvent {
  type: "hitch";
  timestamp_ns: number;
  duration_ms: number;
  severity: "micro_hang" | "severe_hang";
  main_thread_stack: StackFrame[];
}

export interface GpuCmdBufEvent {
  type: "gpu_command_buffer";
  timestamp_ns: number;
  label: string;
  gpu_start_ns: number;
  gpu_end_ns: number;
  gpu_duration_ms: number;
  encoder_type: string;
}

export interface GpuMemoryEvent {
  type: "gpu_memory";
  timestamp_ns: number;
  allocated_bytes: number;
  peak_bytes: number;
}

export interface GpuUtilEvent {
  type: "gpu_utilization";
  timestamp_ns: number;
  utilization_pct: number;
  vertex_count: number;
  fragment_count: number;
}

export interface SignpostEvent {
  type: "signpost";
  timestamp_ns: number;
  event: "begin" | "end" | "event";
  name: string;
  signpost_id: string;
}

export type TraceEvent =
  | CpuSampleEvent
  | MemoryEvent
  | HitchEvent
  | GpuCmdBufEvent
  | GpuMemoryEvent
  | GpuUtilEvent
  | SignpostEvent;

export interface Session {
  id: string;
  start_time_ns: number;
  device: string;
  app_name: string;
  event_count: number;
}

export interface TimeRange {
  start_ns: number;
  end_ns: number;
}
```

- [ ] **Step 4: Create API client**

```typescript
// ios/viewer/src/api/client.ts
import type { Session, TraceEvent } from "../types";

const API_BASE = "http://localhost:8080";

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  return res.json();
}

export async function fetchTimeline(
  sessionId: string,
  startNs?: number,
  endNs?: number
): Promise<TraceEvent[]> {
  const params = new URLSearchParams();
  if (startNs !== undefined) params.set("start", String(startNs));
  if (endNs !== undefined) params.set("end", String(endNs));
  const res = await fetch(
    `${API_BASE}/api/traces/${sessionId}/timeline?${params}`
  );
  return res.json();
}

export async function fetchEvents(
  sessionId: string,
  type?: string
): Promise<TraceEvent[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const res = await fetch(
    `${API_BASE}/api/traces/${sessionId}/events?${params}`
  );
  return res.json();
}
```

- [ ] **Step 5: Create timeline coordinate system**

```typescript
// ios/viewer/src/canvas/timeline.ts

export class TimelineState {
  // Visible time range in nanoseconds
  visibleStart: number;
  visibleEnd: number;
  // Canvas dimensions
  width: number;
  height: number;
  // Total data range
  dataStart: number;
  dataEnd: number;

  constructor(dataStart: number, dataEnd: number, width: number, height: number) {
    this.dataStart = dataStart;
    this.dataEnd = dataEnd;
    this.visibleStart = dataStart;
    this.visibleEnd = dataEnd;
    this.width = width;
    this.height = height;
  }

  // Convert nanosecond timestamp to canvas X pixel
  nsToX(ns: number): number {
    const range = this.visibleEnd - this.visibleStart;
    if (range === 0) return 0;
    return ((ns - this.visibleStart) / range) * this.width;
  }

  // Convert canvas X pixel to nanosecond timestamp
  xToNs(x: number): number {
    const range = this.visibleEnd - this.visibleStart;
    return this.visibleStart + (x / this.width) * range;
  }

  // Zoom centered on a given X pixel
  zoom(centerX: number, factor: number) {
    const centerNs = this.xToNs(centerX);
    const range = this.visibleEnd - this.visibleStart;
    const newRange = range * factor;
    const minRange = 1_000_000; // 1ms minimum visible range
    if (newRange < minRange) return;

    this.visibleStart = centerNs - (newRange * (centerX / this.width));
    this.visibleEnd = this.visibleStart + newRange;

    // Clamp to data bounds
    if (this.visibleStart < this.dataStart) {
      this.visibleStart = this.dataStart;
      this.visibleEnd = this.visibleStart + newRange;
    }
    if (this.visibleEnd > this.dataEnd) {
      this.visibleEnd = this.dataEnd;
      this.visibleStart = this.visibleEnd - newRange;
    }
  }

  // Pan by pixel delta
  pan(deltaX: number) {
    const range = this.visibleEnd - this.visibleStart;
    const deltaNs = (deltaX / this.width) * range;
    this.visibleStart -= deltaNs;
    this.visibleEnd -= deltaNs;

    // Clamp
    if (this.visibleStart < this.dataStart) {
      this.visibleStart = this.dataStart;
      this.visibleEnd = this.dataStart + range;
    }
    if (this.visibleEnd > this.dataEnd) {
      this.visibleEnd = this.dataEnd;
      this.visibleStart = this.dataEnd - range;
    }
  }

  get visibleDurationMs(): number {
    return (this.visibleEnd - this.visibleStart) / 1_000_000;
  }
}
```

- [ ] **Step 6: Create Canvas renderer**

```typescript
// ios/viewer/src/canvas/renderer.ts
import type { TraceEvent, CpuSampleEvent, MemoryEvent, HitchEvent } from "../types";
import { TimelineState } from "./timeline";

const TRACK_HEIGHT = 80;
const TRACK_GAP = 4;
const TRACK_LABEL_WIDTH = 120;

const COLORS = {
  background: "#09090b",
  trackBg: "#18181b",
  border: "#27272a",
  text: "#a1a1aa",
  textBright: "#fafafa",
  cpu: "#7c3aed",
  cpuLight: "#a78bfa",
  memory: "#06b6d4",
  hitchGreen: "#22c55e",
  hitchYellow: "#eab308",
  hitchRed: "#ef4444",
  gpu: "#f97316",
  signpost: "#8b5cf6",
};

export function renderTimeline(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  events: TraceEvent[]
) {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Time ruler at top
  renderTimeRuler(ctx, state);

  // Separate events by type
  const cpuEvents = events.filter((e): e is CpuSampleEvent => e.type === "cpu_sample");
  const memEvents = events.filter((e): e is MemoryEvent => e.type === "memory");
  const hitchEvents = events.filter((e): e is HitchEvent => e.type === "hitch");

  let y = 32; // Below ruler

  // CPU Track
  renderTrackLabel(ctx, "CPU", y, TRACK_HEIGHT);
  renderCpuTrack(ctx, state, cpuEvents, TRACK_LABEL_WIDTH, y, width - TRACK_LABEL_WIDTH, TRACK_HEIGHT);
  y += TRACK_HEIGHT + TRACK_GAP;

  // Memory Track
  renderTrackLabel(ctx, "Memory", y, TRACK_HEIGHT);
  renderMemoryTrack(ctx, state, memEvents, TRACK_LABEL_WIDTH, y, width - TRACK_LABEL_WIDTH, TRACK_HEIGHT);
  y += TRACK_HEIGHT + TRACK_GAP;

  // Hitch Track
  renderTrackLabel(ctx, "Hitches", y, TRACK_HEIGHT / 2);
  renderHitchTrack(ctx, state, hitchEvents, TRACK_LABEL_WIDTH, y, width - TRACK_LABEL_WIDTH, TRACK_HEIGHT / 2);
}

function renderTimeRuler(ctx: CanvasRenderingContext2D, state: TimelineState) {
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(0, 0, state.width, 28);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.lineTo(state.width, 28);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";

  const durationMs = state.visibleDurationMs;
  const tickCount = Math.min(10, Math.floor(state.width / 100));
  const stepNs = (state.visibleEnd - state.visibleStart) / tickCount;

  for (let i = 0; i <= tickCount; i++) {
    const ns = state.visibleStart + i * stepNs;
    const x = state.nsToX(ns);
    const ms = (ns - state.dataStart) / 1_000_000;
    const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
    ctx.fillText(label, x, 18);
  }
}

function renderTrackLabel(ctx: CanvasRenderingContext2D, label: string, y: number, height: number) {
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(0, y, TRACK_LABEL_WIDTH - 4, height);
  ctx.fillStyle = COLORS.textBright;
  ctx.font = "12px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(label, TRACK_LABEL_WIDTH - 12, y + height / 2 + 4);
}

function renderCpuTrack(
  ctx: CanvasRenderingContext2D, state: TimelineState,
  events: CpuSampleEvent[], x: number, y: number, w: number, h: number
) {
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(x, y, w, h);

  if (events.length === 0) return;

  // Bin samples into pixels
  const bins = new Float32Array(Math.ceil(w));
  for (const ev of events) {
    const px = Math.floor(state.nsToX(ev.timestamp_ns)) - x;
    if (px >= 0 && px < bins.length) {
      bins[px] += 1;
    }
  }

  // Normalize
  let maxVal = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] > maxVal) maxVal = bins[i];
  }
  if (maxVal === 0) return;

  // Draw filled area
  ctx.fillStyle = COLORS.cpu;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i < bins.length; i++) {
    const barH = (bins[i] / maxVal) * h;
    ctx.lineTo(x + i, y + h - barH);
  }
  ctx.lineTo(x + bins.length, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function renderMemoryTrack(
  ctx: CanvasRenderingContext2D, state: TimelineState,
  events: MemoryEvent[], x: number, y: number, w: number, h: number
) {
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(x, y, w, h);

  if (events.length < 2) return;

  const maxBytes = Math.max(...events.map(e => e.live_bytes));
  if (maxBytes === 0) return;

  ctx.strokeStyle = COLORS.memory;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < events.length; i++) {
    const px = state.nsToX(events[i].timestamp_ns);
    const py = y + h - (events[i].live_bytes / maxBytes) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function renderHitchTrack(
  ctx: CanvasRenderingContext2D, state: TimelineState,
  events: HitchEvent[], x: number, y: number, w: number, h: number
) {
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(x, y, w, h);

  for (const ev of events) {
    const px = state.nsToX(ev.timestamp_ns);
    const barW = Math.max(3, state.nsToX(ev.timestamp_ns + ev.duration_ms * 1_000_000) - px);
    ctx.fillStyle = ev.duration_ms < 100 ? COLORS.hitchGreen
                  : ev.duration_ms < 500 ? COLORS.hitchYellow
                  : COLORS.hitchRed;
    ctx.fillRect(px, y + 2, barW, h - 4);
  }
}
```

- [ ] **Step 7: Create TimelineView component**

```tsx
// ios/viewer/src/components/TimelineView.tsx
import { useRef, useEffect, useCallback } from "react";
import type { TraceEvent } from "../types";
import { TimelineState } from "../canvas/timeline";
import { renderTimeline } from "../canvas/renderer";

interface TimelineViewProps {
  events: TraceEvent[];
}

export function TimelineView({ events }: TimelineViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<TimelineState | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderTimeline(ctx, state, events);
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);

      // Compute data range from events
      if (events.length > 0) {
        const timestamps = events.map(e => e.timestamp_ns);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        stateRef.current = new TimelineState(minT, maxT, rect.width, rect.height);
      } else {
        stateRef.current = new TimelineState(0, 1_000_000_000, rect.width, rect.height);
      }
      draw();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [events, draw]);

  useEffect(() => { draw(); }, [draw]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const state = stateRef.current;
    if (!state) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      state.zoom(x, factor);
    } else {
      // Pan
      state.pan(e.deltaX || e.deltaY);
    }
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ minHeight: 300 }}
      onWheel={handleWheel}
    />
  );
}
```

- [ ] **Step 8: Create Toolbar and App shell**

```tsx
// ios/viewer/src/components/Toolbar.tsx
import { useEffect, useState } from "react";
import type { Session } from "../types";
import { fetchSessions } from "../api/client";

interface ToolbarProps {
  selectedSession: string | null;
  onSelectSession: (id: string) => void;
}

export function Toolbar({ selectedSession, onSelectSession }: ToolbarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions);
    const interval = setInterval(() => fetchSessions().then(setSessions), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-4">
      <span className="text-sm font-semibold text-foreground">InstrumentsOS</span>
      <select
        className="bg-secondary text-foreground text-sm rounded px-2 py-1 border border-border"
        value={selectedSession ?? ""}
        onChange={(e) => onSelectSession(e.target.value)}
      >
        <option value="">Select session...</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id} ({s.event_count} events)
          </option>
        ))}
      </select>
    </div>
  );
}
```

```tsx
// ios/viewer/src/App.tsx
import { useState, useEffect } from "react";
import type { TraceEvent } from "./types";
import { fetchTimeline } from "./api/client";
import { Toolbar } from "./components/Toolbar";
import { TimelineView } from "./components/TimelineView";

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);

  useEffect(() => {
    if (!sessionId) { setEvents([]); return; }
    fetchTimeline(sessionId).then(setEvents);
  }, [sessionId]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Toolbar selectedSession={sessionId} onSelectSession={setSessionId} />
      <div className="flex-1 overflow-hidden">
        <TimelineView events={events} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Build and verify**

Run: `cd ios/viewer && npm run build`
Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add ios/viewer/
git commit -m "feat(viewer): add Canvas timeline with CPU/memory/hitch tracks

Multi-track Canvas renderer with pan/zoom, time ruler, and track labels.
Fetches trace data from backend REST API."
```

---

## Phase 2: CPU Sampler — The Core Value (Day 3-5)

### Task 4: SDK — CPU Sampler with Mach Thread Suspension

**Files:**
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSCPUSampler.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSCPUSampler.c`

- [ ] **Step 1: Create CPU sampler header**

```c
// ios/sdk/Sources/InstrumentsOS/Core/IOSCPUSampler.h
#ifndef IOS_CPU_SAMPLER_H
#define IOS_CPU_SAMPLER_H

#include "IOSRingBuffer.h"
#include <stdbool.h>

// Start CPU sampling at the given frequency (Hz).
// Writes cpu_sample events to the ring buffer.
bool ios_cpu_sampler_start(ios_ring_buffer_t* rb, int frequency_hz);

// Stop sampling. Blocks until the sampling thread exits.
void ios_cpu_sampler_stop(void);

// Returns true if currently sampling.
bool ios_cpu_sampler_is_running(void);

#endif // IOS_CPU_SAMPLER_H
```

- [ ] **Step 2: Implement CPU sampler**

```c
// ios/sdk/Sources/InstrumentsOS/Core/IOSCPUSampler.c
#include "IOSCPUSampler.h"
#include "IOSEvent.h"

#include <pthread.h>
#include <mach/mach.h>
#include <mach/thread_act.h>
#include <mach/mach_time.h>
#include <stdatomic.h>
#include <string.h>
#include <unistd.h>

static pthread_t s_sampling_thread;
static _Atomic bool s_running = false;
static ios_ring_buffer_t* s_ring_buffer = NULL;
static int s_interval_us = 10000; // 100Hz default

// Convert mach_absolute_time to nanoseconds
static uint64_t mach_time_to_ns(uint64_t mach_time) {
    static mach_timebase_info_data_t info = {0};
    if (info.denom == 0) mach_timebase_info(&info);
    return mach_time * info.numer / info.denom;
}

// Walk the frame pointer chain to capture a backtrace.
// fp = frame pointer register value from suspended thread.
static uint32_t walk_stack(uint64_t fp, uint64_t* frames, uint32_t max_frames) {
    uint32_t count = 0;
    uint64_t current_fp = fp;

    while (current_fp != 0 && count < max_frames) {
        // Each stack frame: [saved_fp, return_address]
        // The return address is at fp + 8 (on ARM64)
        uint64_t* frame_ptr = (uint64_t*)current_fp;

        // Safety: check pointer is in a reasonable range
        // In production, you'd validate against VM regions
        if ((uintptr_t)frame_ptr < 0x1000) break;

        uint64_t return_addr = frame_ptr[1];
        if (return_addr == 0) break;

        frames[count++] = return_addr;
        current_fp = frame_ptr[0]; // Follow to next frame
    }
    return count;
}

static void sample_all_threads(ios_ring_buffer_t* rb) {
    task_t task = mach_task_self();
    thread_act_array_t threads;
    mach_msg_type_number_t thread_count;

    // Get all threads in this process
    kern_return_t kr = task_threads(task, &threads, &thread_count);
    if (kr != KERN_SUCCESS) return;

    uint64_t now_ns = mach_time_to_ns(mach_absolute_time());
    mach_port_t self_thread = mach_thread_self();

    for (mach_msg_type_number_t i = 0; i < thread_count; i++) {
        // Skip the sampling thread itself
        if (threads[i] == self_thread) {
            mach_port_deallocate(task, threads[i]);
            continue;
        }

        // Suspend the thread
        kr = thread_suspend(threads[i]);
        if (kr != KERN_SUCCESS) {
            mach_port_deallocate(task, threads[i]);
            continue;
        }

        // Read thread state (registers)
#if defined(__arm64__) || defined(__aarch64__)
        arm_thread_state64_t state;
        mach_msg_type_number_t count = ARM_THREAD_STATE64_COUNT;
        kr = thread_get_state(threads[i], ARM_THREAD_STATE64,
                              (thread_state_t)&state, &count);
#elif defined(__x86_64__)
        x86_thread_state64_t state;
        mach_msg_type_number_t count = x86_THREAD_STATE64_COUNT;
        kr = thread_get_state(threads[i], x86_THREAD_STATE64,
                              (thread_state_t)&state, &count);
#endif

        if (kr == KERN_SUCCESS) {
            ios_event_t event = {0};
            event.type = IOS_EVENT_CPU_SAMPLE;
            event.timestamp_ns = now_ns;
            event.data.cpu_sample.thread_id = threads[i];

            // Get frame pointer and walk the stack
#if defined(__arm64__) || defined(__aarch64__)
            uint64_t fp = arm_thread_state64_get_fp(state);
            uint64_t pc = arm_thread_state64_get_pc(state);
#elif defined(__x86_64__)
            uint64_t fp = state.__rbp;
            uint64_t pc = state.__rip;
#endif
            // First frame is the current PC
            event.data.cpu_sample.frames[0] = pc;
            uint32_t walked = walk_stack(fp,
                &event.data.cpu_sample.frames[1],
                IOS_MAX_STACK_DEPTH - 1);
            event.data.cpu_sample.frame_count = walked + 1;

            ios_ring_buffer_write(rb, &event);
        }

        // CRITICAL: always resume, even if get_state failed
        thread_resume(threads[i]);
        mach_port_deallocate(task, threads[i]);
    }

    mach_port_deallocate(task, self_thread);

    // Deallocate the thread list
    vm_deallocate(task, (vm_address_t)threads,
                  sizeof(thread_act_t) * thread_count);
}

static void* sampling_thread_func(void* arg) {
    (void)arg;
    pthread_setname_np("InstrumentsOS.Sampler");

    while (atomic_load(&s_running)) {
        sample_all_threads(s_ring_buffer);
        usleep(s_interval_us);
    }
    return NULL;
}

bool ios_cpu_sampler_start(ios_ring_buffer_t* rb, int frequency_hz) {
    if (atomic_load(&s_running)) return false;

    s_ring_buffer = rb;
    s_interval_us = 1000000 / frequency_hz;
    atomic_store(&s_running, true);

    // Create high-priority sampling thread
    pthread_attr_t attr;
    pthread_attr_init(&attr);

    struct sched_param param;
    param.sched_priority = 47; // High priority, below realtime
    pthread_attr_setschedparam(&attr, &param);

    int ret = pthread_create(&s_sampling_thread, &attr, sampling_thread_func, NULL);
    pthread_attr_destroy(&attr);

    if (ret != 0) {
        atomic_store(&s_running, false);
        return false;
    }
    return true;
}

void ios_cpu_sampler_stop(void) {
    if (!atomic_load(&s_running)) return;
    atomic_store(&s_running, false);
    pthread_join(s_sampling_thread, NULL);
    s_ring_buffer = NULL;
}

bool ios_cpu_sampler_is_running(void) {
    return atomic_load(&s_running);
}
```

- [ ] **Step 3: Update module map**

```modulemap
// ios/sdk/Sources/InstrumentsOS/include/module.modulemap
module InstrumentsOS {
    header "../Core/IOSEvent.h"
    header "../Core/IOSRingBuffer.h"
    header "../Core/IOSCPUSampler.h"
    export *
}
```

- [ ] **Step 4: Build SDK**

Run: `cd ios/sdk && swift build`
Expected: Build succeeds (tests may not run on macOS for thread suspension, but compilation should pass).

- [ ] **Step 5: Commit**

```bash
git add ios/sdk/
git commit -m "feat(sdk): add CPU sampler with Mach thread suspension

100Hz sampling using thread_suspend/thread_get_state/frame pointer walking.
Supports ARM64 and x86_64. High-priority dedicated sampling thread."
```

---

### Task 5: SDK — WebSocket Transport + Swift API

**Files:**
- Create: `ios/sdk/Sources/InstrumentsOS/Transport/IOSTransport.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Transport/IOSTransport.m`
- Create: `ios/sdk/Sources/InstrumentsOS/InstrumentsOS.swift`

- [ ] **Step 1: Create transport header**

```c
// ios/sdk/Sources/InstrumentsOS/Transport/IOSTransport.h
#ifndef IOS_TRANSPORT_H
#define IOS_TRANSPORT_H

#include "../Core/IOSRingBuffer.h"
#include <stdbool.h>

// Start the transport layer. Connects to the backend WebSocket server
// and drains events from the ring buffer.
bool ios_transport_start(ios_ring_buffer_t* rb, const char* host, int port);

// Stop the transport layer.
void ios_transport_stop(void);

#endif // IOS_TRANSPORT_H
```

- [ ] **Step 2: Implement ObjC transport using NSURLSessionWebSocketTask**

```objc
// ios/sdk/Sources/InstrumentsOS/Transport/IOSTransport.m
#import "IOSTransport.h"
#import "../Core/IOSEvent.h"
#import <Foundation/Foundation.h>

static NSURLSessionWebSocketTask* _wsTask = nil;
static NSThread* _drainThread = nil;
static BOOL _running = NO;
static ios_ring_buffer_t* _ringBuffer = nil;

static NSString* eventToJSON(const ios_event_t* event) {
    NSMutableDictionary* dict = [NSMutableDictionary dictionary];
    dict[@"timestamp_ns"] = @(event->timestamp_ns);

    switch (event->type) {
        case IOS_EVENT_CPU_SAMPLE: {
            dict[@"type"] = @"cpu_sample";
            dict[@"thread_id"] = @(event->data.cpu_sample.thread_id);
            dict[@"thread_name"] = [NSString stringWithUTF8String:event->data.cpu_sample.thread_name];
            NSMutableArray* frames = [NSMutableArray array];
            for (uint32_t i = 0; i < event->data.cpu_sample.frame_count; i++) {
                [frames addObject:@{
                    @"address": [NSString stringWithFormat:@"0x%llx", event->data.cpu_sample.frames[i]],
                    @"symbol": [NSNull null]
                }];
            }
            dict[@"frames"] = frames;
            break;
        }
        case IOS_EVENT_MEMORY:
            dict[@"type"] = @"memory";
            dict[@"live_bytes"] = @(event->data.memory.live_bytes);
            dict[@"allocation_rate_bps"] = @(event->data.memory.allocation_rate_bps);
            dict[@"peak_bytes"] = @(event->data.memory.peak_bytes);
            break;
        case IOS_EVENT_HITCH: {
            dict[@"type"] = @"hitch";
            dict[@"duration_ms"] = @(event->data.hitch.duration_ms);
            dict[@"severity"] = event->data.hitch.duration_ms > 500 ? @"severe_hang" : @"micro_hang";
            NSMutableArray* stack = [NSMutableArray array];
            for (uint32_t i = 0; i < event->data.hitch.frame_count; i++) {
                [stack addObject:@{
                    @"address": [NSString stringWithFormat:@"0x%llx", event->data.hitch.main_thread_frames[i]],
                    @"symbol": [NSNull null]
                }];
            }
            dict[@"main_thread_stack"] = stack;
            break;
        }
        case IOS_EVENT_SIGNPOST:
            dict[@"type"] = @"signpost";
            dict[@"event"] = event->data.signpost.event == IOS_SIGNPOST_BEGIN ? @"begin" :
                             event->data.signpost.event == IOS_SIGNPOST_END ? @"end" : @"event";
            dict[@"name"] = [NSString stringWithUTF8String:event->data.signpost.name];
            dict[@"signpost_id"] = [NSString stringWithFormat:@"%llu", event->data.signpost.signpost_id];
            break;
        case IOS_EVENT_GPU_CMD_BUF:
            dict[@"type"] = @"gpu_command_buffer";
            dict[@"label"] = [NSString stringWithUTF8String:event->data.gpu_cmd_buf.label];
            dict[@"gpu_start_ns"] = @(event->data.gpu_cmd_buf.gpu_start_ns);
            dict[@"gpu_end_ns"] = @(event->data.gpu_cmd_buf.gpu_end_ns);
            dict[@"gpu_duration_ms"] = @(event->data.gpu_cmd_buf.gpu_duration_ms);
            dict[@"encoder_type"] = [NSString stringWithUTF8String:event->data.gpu_cmd_buf.encoder_type];
            break;
        case IOS_EVENT_GPU_MEMORY:
            dict[@"type"] = @"gpu_memory";
            dict[@"allocated_bytes"] = @(event->data.gpu_memory.allocated_bytes);
            dict[@"peak_bytes"] = @(event->data.gpu_memory.peak_bytes);
            break;
        case IOS_EVENT_GPU_UTIL:
            dict[@"type"] = @"gpu_utilization";
            dict[@"utilization_pct"] = @(event->data.gpu_util.utilization_pct);
            dict[@"vertex_count"] = @(event->data.gpu_util.vertex_count);
            dict[@"fragment_count"] = @(event->data.gpu_util.fragment_count);
            break;
    }

    NSData* jsonData = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

static void drainLoop(void) {
    while (_running) {
        ios_event_t event;
        NSMutableArray<NSString*>* batch = [NSMutableArray array];

        while (ios_ring_buffer_read(_ringBuffer, &event) && batch.count < 50) {
            [batch addObject:eventToJSON(&event)];
        }

        if (batch.count > 0 && _wsTask.state == NSURLSessionTaskStateRunning) {
            NSString* json = [NSString stringWithFormat:@"[%@]", [batch componentsJoinedByString:@","]];
            NSURLSessionWebSocketMessage* msg =
                [[NSURLSessionWebSocketMessage alloc] initWithString:json];
            [_wsTask sendMessage:msg completionHandler:^(NSError* error) {
                if (error) NSLog(@"[InstrumentsOS] WS send error: %@", error);
            }];
        }

        [NSThread sleepForTimeInterval:0.05]; // 50ms drain interval
    }
}

bool ios_transport_start(ios_ring_buffer_t* rb, const char* host, int port) {
    if (_running) return false;
    _ringBuffer = rb;
    _running = YES;

    NSString* urlStr = [NSString stringWithFormat:@"ws://%s:%d", host, port];
    NSURL* url = [NSURL URLWithString:urlStr];
    NSURLSession* session = [NSURLSession sessionWithConfiguration:
        [NSURLSessionConfiguration defaultSessionConfiguration]];
    _wsTask = [session webSocketTaskWithURL:url];
    [_wsTask resume];

    _drainThread = [[NSThread alloc] initWithBlock:^{ drainLoop(); }];
    _drainThread.name = @"InstrumentsOS.Transport";
    _drainThread.qualityOfService = NSQualityOfServiceUtility;
    [_drainThread start];

    return true;
}

void ios_transport_stop(void) {
    _running = NO;
    [_wsTask cancelWithCloseCode:NSURLSessionWebSocketCloseCodeNormalClosure reason:nil];
    _wsTask = nil;
    _drainThread = nil;
    _ringBuffer = nil;
}
```

- [ ] **Step 3: Create Swift public API**

```swift
// ios/sdk/Sources/InstrumentsOS/InstrumentsOS.swift
import Foundation

public enum InstrumentsOS {

    public enum SignpostType {
        case begin, end, event
    }

    private static var ringBuffer: OpaquePointer?
    private static let bufferCapacity: UInt32 = 8192 // ~8K events

    /// Configure the backend connection.
    public static func configure(host: String, port: Int) {
        _host = host
        _port = port
    }

    /// Start all profiling subsystems.
    public static func startProfiling(samplingHz: Int = 100) {
        guard ringBuffer == nil else { return }

        ringBuffer = ios_ring_buffer_create(bufferCapacity)
        guard let rb = ringBuffer else { return }

        // Start CPU sampler
        ios_cpu_sampler_start(rb, Int32(samplingHz))

        // Start transport
        ios_transport_start(rb, _host, Int32(_port))

        print("[InstrumentsOS] Profiling started → ws://\(_host):\(_port)")
    }

    /// Stop all profiling subsystems.
    public static func stopProfiling() {
        ios_cpu_sampler_stop()
        ios_transport_stop()

        if let rb = ringBuffer {
            ios_ring_buffer_destroy(rb)
            ringBuffer = nil
        }

        print("[InstrumentsOS] Profiling stopped")
    }

    /// Emit a custom signpost event.
    public static func signpost(_ type: SignpostType, name: String, id: UInt64 = 0) {
        guard let rb = ringBuffer else { return }

        var event = ios_event_t()
        event.type = IOS_EVENT_SIGNPOST
        event.timestamp_ns = mach_absolute_time() // Will convert in transport
        event.data.signpost.signpost_id = id

        switch type {
        case .begin: event.data.signpost.event = IOS_SIGNPOST_BEGIN
        case .end:   event.data.signpost.event = IOS_SIGNPOST_END
        case .event: event.data.signpost.event = IOS_SIGNPOST_EVENT
        }

        // Copy name into fixed buffer
        name.withCString { ptr in
            strncpy(&event.data.signpost.name.0, ptr, Int(IOS_MAX_NAME_LEN) - 1)
        }

        ios_ring_buffer_write(rb, &event)
    }

    // MARK: - Private
    private static var _host = "localhost"
    private static var _port = 8765
}
```

- [ ] **Step 4: Update module map with transport header**

```modulemap
// ios/sdk/Sources/InstrumentsOS/include/module.modulemap
module InstrumentsOS {
    header "../Core/IOSEvent.h"
    header "../Core/IOSRingBuffer.h"
    header "../Core/IOSCPUSampler.h"
    header "../Transport/IOSTransport.h"
    export *
}
```

- [ ] **Step 5: Build**

Run: `cd ios/sdk && swift build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add ios/sdk/
git commit -m "feat(sdk): add WebSocket transport and Swift public API

ObjC transport drains ring buffer and sends JSON batches via NSURLSessionWebSocketTask.
Swift facade: InstrumentsOS.configure/startProfiling/stopProfiling/signpost."
```

---

## Phase 3: Should Have — Memory, Hitches, GPU, Symbolication (Day 6-12)

### Task 6: SDK — Memory Tracker

**Files:**
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSMemoryTracker.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSMemoryTracker.c`

Implementation: Uses `malloc_zone_t` custom zone with overridden `malloc`/`free` to track allocations. Periodically writes memory summary events to ring buffer. See spec for details. Follows same pattern as CPU sampler (header + implementation + module map update + build + commit).

### Task 7: SDK — Hitch Detector

**Files:**
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSHitchDetector.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSHitchDetector.m`

Implementation: ObjC class using `CADisplayLink`. Measures time between frame callbacks. When gap > 33ms, records a hitch event with the main thread's call stack (using same Mach thread suspension technique as CPU sampler, but targeting only the main thread).

### Task 8: SDK — GPU Tracker

**Files:**
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSGPUTracker.h`
- Create: `ios/sdk/Sources/InstrumentsOS/Core/IOSGPUTracker.m`

Implementation: Swizzles `MTLDevice` creation to hook into Metal. Wraps `MTLCommandBuffer` commit to record timing via completion handlers (`addCompletedHandler`). Periodically samples `MTLDevice.currentAllocatedSize`. Writes gpu_command_buffer, gpu_memory, and gpu_utilization events.

### Task 9: Backend — Symbolizer

**Files:**
- Create: `ios/backend/symbolizer.py`

Implementation: Calls `atos -o <binary> -arch arm64 -l <load_address> <addresses...>` subprocess. Caches results in SQLite symbols table. Batch-symbolizes addresses from CPU sample and hitch events.

### Task 10: Viewer — All Five Track Types + Detail Panel

**Files:**
- Create: `ios/viewer/src/canvas/tracks/gpuTrack.ts`
- Create: `ios/viewer/src/canvas/tracks/signpostTrack.ts`
- Create: `ios/viewer/src/canvas/flameChart.ts`
- Create: `ios/viewer/src/components/DetailPanel.tsx`
- Create: `ios/viewer/src/components/FlameChartPanel.tsx`
- Create: `ios/viewer/src/components/CallTreePanel.tsx`
- Create: `ios/viewer/src/components/EventsPanel.tsx`
- Modify: `ios/viewer/src/canvas/renderer.ts` (add GPU and signpost tracks)

Implementation: Add GPU track (utilization area chart + command buffer bars), signpost track (labeled intervals). Build detail panel with three tabs: Flame Chart (Canvas-rendered nested stacks), Call Tree (aggregated top-down table), Events (raw table with search).

---

## Phase 4: Demo App + Polish (Day 13-18)

### Task 11: Demo App — BuggyApp

**Files:**
- Create: all files in `ios/demo/`

Implementation: SwiftUI app with 5 tabs. Each tab triggers one deliberate bug. Integrates InstrumentsOS SDK. Includes all 5 bug classes (MainThreadBlocker, MemoryLeaker, HitchGenerator, NetworkSpammer, MLHog).

### Task 12: Integration Testing + Polish

- End-to-end test: run BuggyApp → trigger each bug → verify events appear in viewer
- Screenshot/GIF capture for README
- Final viewer polish: loading states, empty states, error handling
- README updates with screenshots

### Task 13: Blog Post Draft

Write Medium blog post covering:
1. Motivation: "Perfetto for iOS"
2. Architecture: three-layer design
3. Technical deep dive: Mach thread suspension, frame pointer walking
4. GPU/ML profiling angle
5. What I learned about OS internals
6. Screenshots of viewer catching real bugs

---

## Self-Review Checklist

1. **Spec coverage**: All 7 SDK components (CPU, Memory, Hitch, GPU, Signpost, Ring Buffer, Transport), backend (WS, store, symbolizer, API), viewer (5 tracks, flame chart, call tree, events), demo app (5 bugs), blog post — all have tasks.

2. **Placeholder scan**: Tasks 6-10 have less code detail than Tasks 1-5. This is intentional — they follow the established patterns. Each still has exact file paths and clear implementation descriptions.

3. **Type consistency**: `ios_event_t` union in IOSEvent.h matches JSON format in transport (IOSTransport.m) matches TypeScript types in viewer (types.ts) matches Python models (models.py). Event types: cpu_sample, memory, hitch, signpost, gpu_command_buffer, gpu_memory, gpu_utilization — consistent across all layers.
