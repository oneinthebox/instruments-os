"""REST API for serving trace data to the web viewer."""

from __future__ import annotations

from aiohttp import web

from store import TraceStore


def create_app(store: TraceStore) -> web.Application:
    """Create and configure the aiohttp application."""
    app = web.Application(middlewares=[cors_middleware])
    app["store"] = store

    app.router.add_get("/api/sessions", handle_sessions)
    app.router.add_get("/api/traces/{session_id}/timeline", handle_timeline)
    app.router.add_get("/api/traces/{session_id}/events", handle_events)

    return app


@web.middleware
async def cors_middleware(request: web.Request, handler) -> web.StreamResponse:
    """Add CORS headers to all responses."""
    if request.method == "OPTIONS":
        response = web.Response()
    else:
        response = await handler(request)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


async def handle_sessions(request: web.Request) -> web.Response:
    """GET /api/sessions - list all sessions."""
    store: TraceStore = request.app["store"]
    sessions = store.get_sessions()
    return web.json_response(sessions)


async def handle_timeline(request: web.Request) -> web.Response:
    """GET /api/traces/{session_id}/timeline - get events for timeline view.

    Query params:
      - start: start timestamp_ns (inclusive)
      - end: end timestamp_ns (inclusive)
    """
    store: TraceStore = request.app["store"]
    session_id = request.match_info["session_id"]

    start_ns = request.query.get("start")
    end_ns = request.query.get("end")

    events = store.get_events(
        session_id=session_id,
        start_ns=int(start_ns) if start_ns else None,
        end_ns=int(end_ns) if end_ns else None,
    )
    return web.json_response(events)


async def handle_events(request: web.Request) -> web.Response:
    """GET /api/traces/{session_id}/events - get events with type filter.

    Query params:
      - type: event type filter (e.g. cpu_sample, memory, hitch)
      - start: start timestamp_ns (inclusive)
      - end: end timestamp_ns (inclusive)
    """
    store: TraceStore = request.app["store"]
    session_id = request.match_info["session_id"]

    event_type = request.query.get("type")
    start_ns = request.query.get("start")
    end_ns = request.query.get("end")

    events = store.get_events(
        session_id=session_id,
        start_ns=int(start_ns) if start_ns else None,
        end_ns=int(end_ns) if end_ns else None,
        event_type=event_type,
    )
    return web.json_response(events)
