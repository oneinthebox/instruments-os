"""Tests for the TraceStore SQLite backend."""

from __future__ import annotations

import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from models import Session, TraceEvent, StackFrame
from store import TraceStore


@pytest.fixture
def store():
    """Create a fresh in-memory TraceStore for each test."""
    s = TraceStore(":memory:")
    yield s
    s.close()


def test_create_session(store: TraceStore) -> None:
    """Test creating and retrieving a session."""
    session = Session(
        id="sess-1",
        start_time_ns=1_000_000_000,
        device="iPhone 15 Pro",
        app_name="MyApp",
        event_count=0,
    )
    store.create_session(session)

    sessions = store.get_sessions()
    assert len(sessions) == 1
    assert sessions[0]["id"] == "sess-1"
    assert sessions[0]["device"] == "iPhone 15 Pro"
    assert sessions[0]["app_name"] == "MyApp"
    assert sessions[0]["start_time_ns"] == 1_000_000_000
    assert sessions[0]["event_count"] == 0


def test_insert_and_query_events(store: TraceStore) -> None:
    """Test inserting events individually and querying them back."""
    store.create_session(Session(id="sess-2", start_time_ns=100))

    events = [
        TraceEvent(type="cpu_sample", timestamp_ns=200, session_id="sess-2", thread_id=1, thread_name="main"),
        TraceEvent(type="memory", timestamp_ns=300, session_id="sess-2", live_bytes=52_428_800),
        TraceEvent(type="hitch", timestamp_ns=400, session_id="sess-2", duration_ms=45.2, severity="micro_hang"),
    ]
    for e in events:
        store.insert_event(e)

    result = store.get_events("sess-2")
    assert len(result) == 3
    assert result[0]["type"] == "cpu_sample"
    assert result[0]["thread_id"] == 1
    assert result[1]["type"] == "memory"
    assert result[1]["live_bytes"] == 52_428_800
    assert result[2]["type"] == "hitch"
    assert result[2]["duration_ms"] == 45.2

    # Verify event_count was updated
    sessions = store.get_sessions()
    assert sessions[0]["event_count"] == 3


def test_query_time_range(store: TraceStore) -> None:
    """Test querying events within a time range."""
    store.create_session(Session(id="sess-3", start_time_ns=0))

    events = [
        TraceEvent(type="cpu_sample", timestamp_ns=100, session_id="sess-3"),
        TraceEvent(type="cpu_sample", timestamp_ns=200, session_id="sess-3"),
        TraceEvent(type="cpu_sample", timestamp_ns=300, session_id="sess-3"),
        TraceEvent(type="cpu_sample", timestamp_ns=400, session_id="sess-3"),
        TraceEvent(type="cpu_sample", timestamp_ns=500, session_id="sess-3"),
    ]
    store.insert_events_batch(events)

    # Query a sub-range
    result = store.get_events("sess-3", start_ns=200, end_ns=400)
    assert len(result) == 3
    assert result[0]["timestamp_ns"] == 200
    assert result[-1]["timestamp_ns"] == 400

    # Query with only start
    result = store.get_events("sess-3", start_ns=400)
    assert len(result) == 2

    # Query with only end
    result = store.get_events("sess-3", end_ns=200)
    assert len(result) == 2


def test_query_by_type(store: TraceStore) -> None:
    """Test filtering events by type."""
    store.create_session(Session(id="sess-4", start_time_ns=0))

    events = [
        TraceEvent(type="cpu_sample", timestamp_ns=100, session_id="sess-4"),
        TraceEvent(type="memory", timestamp_ns=200, session_id="sess-4", live_bytes=1024),
        TraceEvent(type="cpu_sample", timestamp_ns=300, session_id="sess-4"),
        TraceEvent(type="hitch", timestamp_ns=400, session_id="sess-4", duration_ms=10.0),
        TraceEvent(type="memory", timestamp_ns=500, session_id="sess-4", live_bytes=2048),
    ]
    store.insert_events_batch(events)

    cpu_events = store.get_events("sess-4", event_type="cpu_sample")
    assert len(cpu_events) == 2
    assert all(e["type"] == "cpu_sample" for e in cpu_events)

    mem_events = store.get_events("sess-4", event_type="memory")
    assert len(mem_events) == 2
    assert mem_events[0]["live_bytes"] == 1024
    assert mem_events[1]["live_bytes"] == 2048

    hitch_events = store.get_events("sess-4", event_type="hitch")
    assert len(hitch_events) == 1
    assert hitch_events[0]["duration_ms"] == 10.0

    # Combine type + time range
    result = store.get_events("sess-4", event_type="memory", start_ns=300)
    assert len(result) == 1
    assert result[0]["live_bytes"] == 2048


def test_symbol_cache(store: TraceStore) -> None:
    """Test symbol caching (insert, lookup, update)."""
    # Initially no symbol
    assert store.get_symbol("0x100003a40") is None

    # Cache a symbol
    store.cache_symbol("0x100003a40", "-[AppDelegate application:didFinishLaunching:]", "AppDelegate.m", 42)

    sym = store.get_symbol("0x100003a40")
    assert sym is not None
    assert sym["symbol"] == "-[AppDelegate application:didFinishLaunching:]"
    assert sym["file"] == "AppDelegate.m"
    assert sym["line"] == 42

    # Update (replace) the symbol
    store.cache_symbol("0x100003a40", "updated_symbol", "NewFile.swift", 99)
    sym = store.get_symbol("0x100003a40")
    assert sym["symbol"] == "updated_symbol"
    assert sym["file"] == "NewFile.swift"
    assert sym["line"] == 99
