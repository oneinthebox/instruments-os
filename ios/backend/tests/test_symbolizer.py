"""Tests for the Symbolizer."""

from __future__ import annotations

import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from store import TraceStore
from symbolizer import Symbolizer


@pytest.fixture
def store():
    """Create a fresh in-memory TraceStore for each test."""
    s = TraceStore(":memory:")
    yield s
    s.close()


def test_symbolize_caches_result(store: TraceStore) -> None:
    """Test that symbolizer uses cache."""
    store.cache_symbol("0x1000", "main()")
    sym = Symbolizer(store)
    assert sym.symbolize("0x1000") == "main()"


def test_symbolize_event_fills_frames(store: TraceStore) -> None:
    """Test that symbolize_event fills in cached symbols."""
    store.cache_symbol("0x1000", "main()")
    sym = Symbolizer(store)
    event = {"frames": [{"address": "0x1000", "symbol": None}]}
    sym.symbolize_event(event)
    assert event["frames"][0]["symbol"] == "main()"


def test_unknown_address_returns_none(store: TraceStore) -> None:
    """Test that unknown addresses return None."""
    sym = Symbolizer(store)
    assert sym.symbolize("0x9999") is None


def test_unknown_address_added_to_pending(store: TraceStore) -> None:
    """Test that unknown addresses are added to pending set."""
    sym = Symbolizer(store)
    sym.symbolize("0x9999")
    assert "0x9999" in sym._pending


def test_symbolize_event_fills_main_thread_stack(store: TraceStore) -> None:
    """Test that symbolize_event fills main_thread_stack frames."""
    store.cache_symbol("0x2000", "viewDidLoad()")
    sym = Symbolizer(store)
    event = {"main_thread_stack": [{"address": "0x2000", "symbol": None}]}
    sym.symbolize_event(event)
    assert event["main_thread_stack"][0]["symbol"] == "viewDidLoad()"


def test_symbolize_event_skips_already_symbolized(store: TraceStore) -> None:
    """Test that symbolize_event does not overwrite existing symbols."""
    store.cache_symbol("0x1000", "main()")
    sym = Symbolizer(store)
    event = {"frames": [{"address": "0x1000", "symbol": "originalSymbol"}]}
    sym.symbolize_event(event)
    assert event["frames"][0]["symbol"] == "originalSymbol"


def test_flush_without_dsym_is_noop(store: TraceStore) -> None:
    """Test that flush does nothing when no dsym/binary path is set."""
    sym = Symbolizer(store)
    sym._pending.add("0x1000")
    sym.flush()
    # Pending remains since no dsym/binary to resolve against
    assert "0x1000" in sym._pending
    assert store.get_symbol("0x1000") is None


def test_symbolize_events_batch(store: TraceStore) -> None:
    """Test that symbolize_events processes a batch of events."""
    store.cache_symbol("0x1000", "main()")
    store.cache_symbol("0x2000", "viewDidLoad()")
    sym = Symbolizer(store)
    events = [
        {"frames": [{"address": "0x1000", "symbol": None}]},
        {"main_thread_stack": [{"address": "0x2000", "symbol": None}]},
    ]
    result = sym.symbolize_events(events)
    assert result[0]["frames"][0]["symbol"] == "main()"
    assert result[1]["main_thread_stack"][0]["symbol"] == "viewDidLoad()"
