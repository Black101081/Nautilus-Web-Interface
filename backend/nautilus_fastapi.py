"""
FastAPI Backend — Nautilus Trader Web Interface (production entry point)
App setup only: middleware, routers, WebSocket, startup events, health check.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))
os.environ.setdefault(
    "NAUTILUS_CATALOG_PATH",
    str(backend_dir.parent / "nautilus_data" / "catalog"),
)

from auth import API_KEY, ApiKeyMiddleware          # noqa: E402
from nautilus_core import NautilusTradingSystem     # noqa: E402
import alerts_db                                    # noqa: E402
import database                                     # noqa: E402
from routers import (                               # noqa: E402
    adapters, alerts, backtest, components,
    market_data, orders, positions, risk,
    strategies, system as system_router,
)

# ---------------------------------------------------------------------------
# App & middleware
# ---------------------------------------------------------------------------

app = FastAPI(title="Nautilus Trader API", version="2.0.0")

_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    or ["http://localhost:5173", "http://localhost:3000"]
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(ApiKeyMiddleware)

# ---------------------------------------------------------------------------
# Thread-safe request counter
# ---------------------------------------------------------------------------

# asyncio.Lock() at module level is safe in Python 3.10+ (no running loop required
# at creation time — the lock attaches to the running loop on the first await).
_counter_lock = asyncio.Lock()
_request_counter = 0


async def _increment_counter() -> int:
    global _request_counter
    async with _counter_lock:
        _request_counter += 1
        return _request_counter


@app.middleware("http")
async def _count_requests(request: Request, call_next):
    await _increment_counter()
    return await call_next(request)


# ---------------------------------------------------------------------------
# Trading system + router wiring
# ---------------------------------------------------------------------------

nautilus_system = NautilusTradingSystem(
    catalog_path=os.environ["NAUTILUS_CATALOG_PATH"]
)

for mod in (strategies, orders, positions, risk, components, backtest):
    mod.set_nautilus_system(nautilus_system)
system_router.set_request_counter(lambda: _request_counter)

for router_mod in (
    strategies, orders, positions, market_data, alerts,
    risk, system_router, components, backtest, adapters,
):
    app.include_router(router_mod.router)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def startup_event():
    await alerts_db.init_db()
    await database.init_db()


# ---------------------------------------------------------------------------
# Root & health
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    return {"name": "Nautilus Trader API", "version": "2.0.0", "status": "running"}


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0",
    }


@app.get("/health")
async def health_check_legacy():
    return await health_check()


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default=None)):
    """Real-time engine events. Supply ?token=<API_KEY> when API_KEY is set."""
    if API_KEY and token != API_KEY:
        await websocket.close(code=4003, reason="Invalid token")
        return

    await websocket.accept()
    info = nautilus_system.get_system_info()
    try:
        await websocket.send_json({
            "type": "connection", "status": "connected",
            "trader_id": info["trader_id"],
            "is_initialized": info["is_initialized"],
        })
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if json.loads(data).get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "type": "heartbeat",
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"WebSocket error: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("NAUTILUS_API_PORT", "8000")))
