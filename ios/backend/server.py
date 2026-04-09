"""Entry point: starts WebSocket server and REST API concurrently."""

from __future__ import annotations

import asyncio
import logging

import websockets
from aiohttp import web

from api import create_app
from store import TraceStore
from ws_handler import WSHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

WS_HOST = "0.0.0.0"
WS_PORT = 8765
API_HOST = "0.0.0.0"
API_PORT = 8080


async def main() -> None:
    store = TraceStore("instrumentsos.db")
    ws_handler = WSHandler(store)

    # Route WebSocket connections: /viewer -> live viewer, default -> SDK handler
    # websockets 13+ no longer passes `path` as a second arg; use websocket.request.path
    async def ws_router(websocket) -> None:
        path = getattr(websocket, "request", None)
        if path is not None:
            path = path.path
        else:
            path = "/"
        if path == "/viewer":
            await ws_handler.handle_viewer_connection(websocket)
        else:
            await ws_handler.handle_sdk_connection(websocket)

    # Start WebSocket server
    ws_server = await websockets.serve(ws_router, WS_HOST, WS_PORT)
    logger.info("WebSocket server listening on ws://%s:%d", WS_HOST, WS_PORT)

    # Start REST API server
    app = create_app(store)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, API_HOST, API_PORT)
    await site.start()
    logger.info("REST API server listening on http://%s:%d", API_HOST, API_PORT)

    try:
        await asyncio.Future()  # Run forever
    except asyncio.CancelledError:
        pass
    finally:
        ws_server.close()
        await ws_server.wait_closed()
        await runner.cleanup()
        store.close()
        logger.info("Servers shut down.")


if __name__ == "__main__":
    asyncio.run(main())
