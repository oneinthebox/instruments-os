"""Data models for InstrumentsOS trace events."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class StackFrame:
    address: str
    symbol: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> StackFrame:
        return cls(address=d["address"], symbol=d.get("symbol"))


@dataclass
class TraceEvent:
    type: str
    timestamp_ns: int
    session_id: Optional[str] = None

    # cpu_sample fields
    thread_id: Optional[int] = None
    thread_name: Optional[str] = None
    frames: Optional[list[StackFrame]] = None

    # memory fields
    live_bytes: Optional[int] = None
    allocation_rate_bps: Optional[int] = None
    peak_bytes: Optional[int] = None

    # hitch fields
    duration_ms: Optional[float] = None
    severity: Optional[str] = None
    main_thread_stack: Optional[list[StackFrame]] = None

    # signpost fields
    event: Optional[str] = None
    name: Optional[str] = None
    signpost_id: Optional[str] = None

    # gpu_command_buffer fields
    label: Optional[str] = None
    gpu_start_ns: Optional[int] = None
    gpu_end_ns: Optional[int] = None
    gpu_duration_ms: Optional[float] = None
    encoder_type: Optional[str] = None

    # gpu_memory fields
    allocated_bytes: Optional[int] = None
    # peak_bytes is shared with memory

    # gpu_utilization fields
    utilization_pct: Optional[float] = None
    vertex_count: Optional[int] = None
    fragment_count: Optional[int] = None

    def to_json_data(self) -> str:
        """Serialize all event-specific fields to a JSON string for storage."""
        d = asdict(self)
        # Remove the common fields that are stored in their own columns
        for key in ("type", "timestamp_ns", "session_id"):
            d.pop(key, None)
        # Convert StackFrame lists to plain dicts
        # (asdict already does this, but strip None values for compactness)
        cleaned = {k: v for k, v in d.items() if v is not None}
        return json.dumps(cleaned)

    @classmethod
    def from_dict(cls, d: dict) -> TraceEvent:
        """Parse a JSON dict (as received from SDK) into a TraceEvent."""
        frames = None
        if "frames" in d and d["frames"] is not None:
            frames = [StackFrame.from_dict(f) for f in d["frames"]]

        main_thread_stack = None
        if "main_thread_stack" in d and d["main_thread_stack"] is not None:
            main_thread_stack = [StackFrame.from_dict(f) for f in d["main_thread_stack"]]

        return cls(
            type=d["type"],
            timestamp_ns=d["timestamp_ns"],
            session_id=d.get("session_id"),
            thread_id=d.get("thread_id"),
            thread_name=d.get("thread_name"),
            frames=frames,
            live_bytes=d.get("live_bytes"),
            allocation_rate_bps=d.get("allocation_rate_bps"),
            peak_bytes=d.get("peak_bytes"),
            duration_ms=d.get("duration_ms"),
            severity=d.get("severity"),
            main_thread_stack=main_thread_stack,
            event=d.get("event"),
            name=d.get("name"),
            signpost_id=d.get("signpost_id"),
            label=d.get("label"),
            gpu_start_ns=d.get("gpu_start_ns"),
            gpu_end_ns=d.get("gpu_end_ns"),
            gpu_duration_ms=d.get("gpu_duration_ms"),
            encoder_type=d.get("encoder_type"),
            allocated_bytes=d.get("allocated_bytes"),
            utilization_pct=d.get("utilization_pct"),
            vertex_count=d.get("vertex_count"),
            fragment_count=d.get("fragment_count"),
        )


@dataclass
class Session:
    id: str
    start_time_ns: int
    device: str = ""
    app_name: str = ""
    event_count: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> Session:
        return cls(
            id=d["id"],
            start_time_ns=d["start_time_ns"],
            device=d.get("device", ""),
            app_name=d.get("app_name", ""),
            event_count=d.get("event_count", 0),
        )
