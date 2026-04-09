"""WebSocket handler for receiving SDK trace events."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Optional

import websockets
import websockets.exceptions

from models import Session, TraceEvent
from store import TraceStore

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


class WSHandler:
    """Handles WebSocket connections from the iOS SDK."""

    def __init__(self, store: TraceStore):
        self.store = store
        self.live_subscribers: set = set()

    async def handle_sdk_connection(self, websocket) -> None:
        """Handle a single SDK WebSocket connection.

        Creates a session per connection, batches events, writes to store,
        and forwards to any live subscribers (web viewers).
        """
        session_id = str(uuid.uuid4())
        session = Session(
            id=session_id,
            start_time_ns=time.time_ns(),
            device="unknown",
            app_name="unknown",
        )
        self.store.create_session(session)
        logger.info("New SDK session: %s", session_id)

        batch: list[TraceEvent] = []

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from SDK: %s", message[:200])
                    continue

                # Handle session metadata if provided
                if data.get("type") == "session_start":
                    device = data.get("device", "unknown")
                    app_name = data.get("app_name", "unknown")
                    self.store._conn.execute(
                        "UPDATE sessions SET device = ?, app_name = ? WHERE id = ?",
                        (device, app_name, session_id),
                    )
                    self.store._conn.commit()
                    continue

                event = self._parse_event(data, session_id)
                if event is None:
                    continue

                batch.append(event)

                if len(batch) >= BATCH_SIZE:
                    self.store.insert_events_batch(batch)
                    await self._forward_to_subscribers(batch)
                    batch = []

        except websockets.exceptions.ConnectionClosed:
            logger.info("SDK connection closed for session %s", session_id)
        finally:
            # Flush remaining events
            if batch:
                self.store.insert_events_batch(batch)
                await self._forward_to_subscribers(batch)
            logger.info("Session %s complete", session_id)

    def _parse_event(self, data: dict, session_id: str) -> Optional[TraceEvent]:
        """Parse a JSON dict into a TraceEvent, returning None on failure."""
        try:
            if "type" not in data or "timestamp_ns" not in data:
                logger.warning("Event missing required fields: %s", data)
                return None
            data["session_id"] = session_id
            return TraceEvent.from_dict(data)
        except Exception:
            logger.exception("Failed to parse event: %s", data)
            return None

    async def _forward_to_subscribers(self, events: list[TraceEvent]) -> None:
        """Forward events to all live web viewer subscribers."""
        if not self.live_subscribers:
            return

        payload = json.dumps([
            {
                "type": e.type,
                "timestamp_ns": e.timestamp_ns,
                "session_id": e.session_id,
                **json.loads(e.to_json_data()),
            }
            for e in events
        ])

        dead: set = set()
        for sub in self.live_subscribers:
            try:
                await sub.send(payload)
            except websockets.exceptions.ConnectionClosed:
                dead.add(sub)
        self.live_subscribers -= dead

    async def handle_viewer_connection(self, websocket) -> None:
        """Handle a web viewer subscribing to live events."""
        self.live_subscribers.add(websocket)
        logger.info("Viewer connected, total: %d", len(self.live_subscribers))
        try:
            async for _ in websocket:
                pass  # Keep connection open; viewer is read-only
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.live_subscribers.discard(websocket)
            logger.info("Viewer disconnected, total: %d", len(self.live_subscribers))
