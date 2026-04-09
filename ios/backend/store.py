"""SQLite-backed trace event store."""

from __future__ import annotations

import json
import sqlite3
from typing import Optional

from models import Session, TraceEvent, StackFrame


class TraceStore:
    """Wraps a SQLite database for storing trace sessions and events."""

    def __init__(self, db_path: str = ":memory:"):
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._create_tables()

    def _create_tables(self) -> None:
        cur = self._conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                start_time_ns INTEGER NOT NULL,
                device TEXT NOT NULL DEFAULT '',
                app_name TEXT NOT NULL DEFAULT '',
                event_count INTEGER NOT NULL DEFAULT 0
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                type TEXT NOT NULL,
                timestamp_ns INTEGER NOT NULL,
                data TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_session_ts
            ON events (session_id, timestamp_ns)
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS symbols (
                address TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                file TEXT NOT NULL DEFAULT '',
                line INTEGER NOT NULL DEFAULT 0
            )
        """)
        self._conn.commit()

    def create_session(self, session: Session) -> None:
        """Insert a new session record."""
        self._conn.execute(
            "INSERT INTO sessions (id, start_time_ns, device, app_name, event_count) VALUES (?, ?, ?, ?, ?)",
            (session.id, session.start_time_ns, session.device, session.app_name, session.event_count),
        )
        self._conn.commit()

    def insert_event(self, event: TraceEvent) -> None:
        """Insert a single trace event."""
        self._conn.execute(
            "INSERT INTO events (session_id, type, timestamp_ns, data) VALUES (?, ?, ?, ?)",
            (event.session_id, event.type, event.timestamp_ns, event.to_json_data()),
        )
        self._conn.execute(
            "UPDATE sessions SET event_count = event_count + 1 WHERE id = ?",
            (event.session_id,),
        )
        self._conn.commit()

    def insert_events_batch(self, events: list[TraceEvent]) -> None:
        """Insert a batch of trace events in a single transaction."""
        if not events:
            return
        cur = self._conn.cursor()
        rows = [
            (e.session_id, e.type, e.timestamp_ns, e.to_json_data())
            for e in events
        ]
        cur.executemany(
            "INSERT INTO events (session_id, type, timestamp_ns, data) VALUES (?, ?, ?, ?)",
            rows,
        )
        # Update event counts per session
        session_counts: dict[str, int] = {}
        for e in events:
            sid = e.session_id or ""
            session_counts[sid] = session_counts.get(sid, 0) + 1
        for sid, count in session_counts.items():
            cur.execute(
                "UPDATE sessions SET event_count = event_count + ? WHERE id = ?",
                (count, sid),
            )
        self._conn.commit()

    def get_sessions(self) -> list[dict]:
        """Return all sessions as dicts."""
        cur = self._conn.execute(
            "SELECT id, start_time_ns, device, app_name, event_count FROM sessions ORDER BY start_time_ns DESC"
        )
        return [dict(row) for row in cur.fetchall()]

    def get_events(
        self,
        session_id: str,
        start_ns: Optional[int] = None,
        end_ns: Optional[int] = None,
        event_type: Optional[str] = None,
    ) -> list[dict]:
        """Query events with optional time range and type filtering."""
        query = "SELECT id, session_id, type, timestamp_ns, data FROM events WHERE session_id = ?"
        params: list = [session_id]

        if start_ns is not None:
            query += " AND timestamp_ns >= ?"
            params.append(start_ns)
        if end_ns is not None:
            query += " AND timestamp_ns <= ?"
            params.append(end_ns)
        if event_type is not None:
            query += " AND type = ?"
            params.append(event_type)

        query += " ORDER BY timestamp_ns ASC"

        cur = self._conn.execute(query, params)
        results = []
        for row in cur.fetchall():
            d = dict(row)
            # Parse the JSON data field back into a dict and merge
            data = json.loads(d.pop("data"))
            d.update(data)
            results.append(d)
        return results

    def get_symbol(self, address: str) -> Optional[dict]:
        """Look up a symbol by address."""
        cur = self._conn.execute(
            "SELECT address, symbol, file, line FROM symbols WHERE address = ?",
            (address,),
        )
        row = cur.fetchone()
        return dict(row) if row else None

    def cache_symbol(self, address: str, symbol: str, file: str = "", line: int = 0) -> None:
        """Insert or update a symbol in the cache."""
        self._conn.execute(
            "INSERT OR REPLACE INTO symbols (address, symbol, file, line) VALUES (?, ?, ?, ?)",
            (address, symbol, file, line),
        )
        self._conn.commit()

    def close(self) -> None:
        """Close the database connection."""
        self._conn.close()
