"""
Nautilus Trader API — production entry point.
This file wires the FastAPI app together; business logic lives in routers/.
"""

import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend dir is on the path so routers can import sibling modules
sys.path.insert(0, str(Path(__file__).parent))

import database
from auth import ApiKeyMiddleware
from routers import (
    adapters,
    alerts,
    backtest,
    components,
    database_ops,
    market_data,
    orders,
    positions,
    risk,
    strategies,
    system,
)
from state import manager, nautilus_system


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialise the SQLite schema + seed defaults
    await database.init_db()
    yield
    # Shutdown: nothing to clean up


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Nautilus Trader API",
    description="Real Nautilus Trader integration API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — set CORS_ORIGINS env var in production (comma-separated)
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    or ["http://localhost:5173", "http://localhost:3000"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key auth (enabled when API_KEY env var is set)
app.add_middleware(ApiKeyMiddleware)

# Request counter middleware (async-safe)
@app.middleware("http")
async def _count_requests(request: Request, call_next):
    await system.increment_request_counter()
    return await call_next(request)


# ── Include routers ───────────────────────────────────────────────────────────

app.include_router(strategies.router)
app.include_router(orders.router)
app.include_router(positions.router)
app.include_router(risk.router)
app.include_router(market_data.router)
app.include_router(alerts.router)
app.include_router(system.router)
app.include_router(backtest.router)
app.include_router(adapters.router)
app.include_router(database_ops.router)
app.include_router(components.router)


# ── Root endpoint ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "Nautilus Trader API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


# Alias so /health works in addition to /api/health
@app.get("/health")
async def health_alias():
    from datetime import datetime, timezone
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0",
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        info = nautilus_system.get_system_info()
        await websocket.send_json(
            {
                "type": "connection",
                "status": "connected",
                "trader_id": info["trader_id"],
                "is_initialized": info["is_initialized"],
            }
        )
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                from datetime import datetime, timezone
                await websocket.send_json(
                    {"type": "heartbeat", "ts": datetime.now(timezone.utc).isoformat()}
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("NAUTILUS_API_PORT", "8000"))
    print(f"Starting Nautilus Trader API on port {port}")
    print(f"Docs: http://0.0.0.0:{port}/docs")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
