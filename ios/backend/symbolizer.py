# ios/backend/symbolizer.py
"""Converts raw memory addresses to human-readable function names using Apple's atos."""

from __future__ import annotations

import re
import subprocess

from store import TraceStore


class Symbolizer:
    def __init__(
        self,
        store: TraceStore,
        dsym_path: str | None = None,
        binary_path: str | None = None,
        load_address: str = "0x0",
    ):
        self.store = store
        self.dsym_path = dsym_path
        self.binary_path = binary_path
        self.load_address = load_address
        self._pending: set[str] = set()

    def symbolize(self, address: str) -> str | None:
        """Get symbol for address. Returns cached result or None."""
        cached = self.store.get_symbol(address)
        if cached:
            return cached["symbol"]
        self._pending.add(address)
        return None

    def flush(self) -> None:
        """Batch-symbolize all pending addresses using atos."""
        if not self._pending or not (self.dsym_path or self.binary_path):
            return

        addresses = list(self._pending)
        self._pending.clear()

        # Filter out already-cached
        uncached = [a for a in addresses if self.store.get_symbol(a) is None]
        if not uncached:
            return

        try:
            cmd = ["atos"]
            if self.dsym_path:
                cmd += ["-o", self.dsym_path]
            elif self.binary_path:
                cmd += ["-o", self.binary_path]
            cmd += ["-arch", "arm64", "-l", self.load_address]
            cmd += uncached

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                for addr, line in zip(uncached, lines):
                    # atos output format: "functionName (in BinaryName) (file:line)"
                    # or just the address back if symbolication fails
                    symbol = line.strip()
                    if symbol and symbol != addr:
                        # Extract just the function name
                        match = re.match(r"^(.+?)\s+\(in\s+", symbol)
                        func_name = match.group(1) if match else symbol
                        self.store.cache_symbol(addr, func_name)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass  # atos not available or timed out

    def symbolize_event(self, event: dict) -> dict:
        """Symbolize all addresses in a trace event dict (in-place)."""
        if "frames" in event and event["frames"]:
            for frame in event["frames"]:
                if frame.get("address") and not frame.get("symbol"):
                    sym = self.symbolize(frame["address"])
                    if sym:
                        frame["symbol"] = sym

        if "main_thread_stack" in event and event["main_thread_stack"]:
            for frame in event["main_thread_stack"]:
                if frame.get("address") and not frame.get("symbol"):
                    sym = self.symbolize(frame["address"])
                    if sym:
                        frame["symbol"] = sym

        return event

    def symbolize_events(self, events: list[dict]) -> list[dict]:
        """Symbolize a batch of events. Calls flush() to batch atos invocations."""
        # First pass: queue all addresses
        for event in events:
            self.symbolize_event(event)

        # Batch symbolize
        self.flush()

        # Second pass: fill in newly resolved symbols
        for event in events:
            self.symbolize_event(event)

        return events
