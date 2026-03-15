"""
Nautilus Trader API — production entry point.
This file wires the FastAPI app together; business logic lives in routers/.
"""

import asyncio
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
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

# Request counter middleware
@app.middleware("http")
async def _count_requests(request: Request, call_next):
    system.increment_request_counter()
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
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0",
    }


# ── WebSocket live-data helpers ───────────────────────────────────────────────

async def _collect_live_snapshot() -> dict:
    """Gather a lightweight snapshot of live system state for WebSocket push."""
    info = nautilus_system.get_system_info()

    # System metrics (non-blocking psutil)
    metrics: dict = {}
    try:
        import psutil
        metrics = {
            "cpu_percent": round(psutil.cpu_percent(interval=None), 1),
            "memory_percent": round(psutil.virtual_memory().percent, 1),
        }
    except Exception:
        pass

    # Strategies
    strategy_list = [
        {
            "id": s["id"],
            "name": s.get("name", s["id"]),
            "status": s.get("status", "unknown"),
        }
        for s in nautilus_system.get_all_strategies()
    ]

    # Open positions (from latest backtest results, filtered by closed set)
    all_positions = []
    for results in nautilus_system.backtest_results.values():
        all_positions.extend(results.get("positions", []))
    open_positions = [p for p in all_positions if p.get("is_open")]

    # Recent orders count
    order_count = sum(
        len(r.get("orders", []))
        for r in nautilus_system.backtest_results.values()
    )

    return {
        "type": "live_data",
        "ts": datetime.now(timezone.utc).isoformat(),
        "engine": {
            "is_initialized": info["is_initialized"],
            "trader_id": info["trader_id"],
            "strategies_count": info["strategies_count"],
            "backtests_count": info["backtests_count"],
        },
        "metrics": metrics,
        "strategies": strategy_list,
        "open_positions_count": len(open_positions),
        "total_orders_count": order_count,
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    last_push = 0.0
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
                # Short timeout so we can push live data on schedule
                data = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                now = time.time()
                # Heartbeat every tick
                await websocket.send_json(
                    {"type": "heartbeat", "ts": datetime.now(timezone.utc).isoformat()}
                )
                # Full live-data push every 3 seconds
                if now - last_push >= 3.0:
                    snapshot = await _collect_live_snapshot()
                    await websocket.send_json(snapshot)
                    last_push = now
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("NAUTILUS_API_PORT", "8000"))
    print(f"Starting Nautilus Trader API on port {port}")
    print(f"Docs: http://0.0.0.0:{port}/docs")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
