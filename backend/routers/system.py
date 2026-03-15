import time
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Body

import database
from state import nautilus_system
from utils import normalize_order

router = APIRouter(prefix="/api", tags=["system"])

_server_start_time = time.time()
_request_counter = 0


def increment_request_counter() -> None:
    # asyncio is single-threaded: += on int is safe without a lock
    # (no await between the read and write means no interleaving)
    global _request_counter
    _request_counter += 1


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0",
    }


@router.get("/engine/info")
async def get_engine_info():
    info = nautilus_system.get_system_info()
    return {
        "trader_id": info["trader_id"],
        "status": "running" if info["is_initialized"] else "initializing",
        "engine_type": "BacktestEngine",
        "is_running": info["is_initialized"],
        "strategies_count": info["strategies_count"],
        "backtests_count": len(nautilus_system.backtest_results),
        "is_initialized": info["is_initialized"],
        "catalog_path": info["catalog_path"],
        "uptime": "active",
    }


@router.post("/engine/initialize")
async def initialize_system():
    result = nautilus_system.initialize()
    if not result["success"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/engine/shutdown")
async def shutdown_system():
    return {"success": True, "message": "Engine shutdown requested"}


@router.get("/components")
async def list_components():
    info = nautilus_system.get_system_info()
    active = info["is_initialized"]
    components = [
        {"id": "data_engine",  "name": "Data Engine",       "type": "DataEngine",      "status": "running" if active else "stopped"},
        {"id": "exec_engine",  "name": "Execution Engine",  "type": "ExecutionEngine", "status": "running" if active else "stopped"},
        {"id": "risk_engine",  "name": "Risk Engine",       "type": "RiskEngine",      "status": "running" if active else "stopped"},
        {"id": "portfolio",    "name": "Portfolio",          "type": "Portfolio",       "status": "active"  if active else "stopped"},
        {"id": "cache",        "name": "Cache",              "type": "Cache",           "status": "active"},
        {"id": "message_bus",  "name": "MessageBus",         "type": "MessageBus",      "status": "active"},
    ]
    return {"components": components, "count": len(components)}


@router.get("/system/metrics")
async def get_system_metrics():
    uptime_secs = time.time() - _server_start_time
    hours = int(uptime_secs // 3600)
    minutes = int((uptime_secs % 3600) // 60)
    base = {
        "uptime_seconds": round(uptime_secs),
        "uptime_formatted": f"{hours}h {minutes}m",
        "requests_total": _request_counter,
    }
    try:
        import psutil

        cpu = psutil.cpu_percent(interval=None)  # non-blocking; returns cached value
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            **base,
            "cpu_percent": round(cpu, 1),
            "memory_used_gb": round(mem.used / 1024**3, 2),
            "memory_total_gb": round(mem.total / 1024**3, 2),
            "memory_percent": round(mem.percent, 1),
            "disk_used_gb": round(disk.used / 1024**3, 1),
            "disk_total_gb": round(disk.total / 1024**3, 1),
            "disk_percent": round(disk.percent, 1),
        }
    except Exception:
        return {**base, "cpu_percent": 0.0, "memory_percent": 0.0, "disk_percent": 0.0}


@router.get("/settings")
async def get_settings():
    return await database.get_settings()


@router.post("/settings")
async def save_settings(body: Dict[str, Any] = Body(...)):
    settings = await database.update_settings(body)
    return {"success": True, "settings": settings}


@router.get("/performance/summary")
async def get_performance_summary():
    total_pnl = realized_pnl = 0.0
    total_trades = winning_trades = losing_trades = 0
    all_positions = open_positions = 0

    for results in nautilus_system.backtest_results.values():
        total_pnl += results.get("total_pnl", 0.0)
        realized_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
        winning_trades += results.get("winning_trades", 0)
        losing_trades += results.get("losing_trades", 0)
        all_positions += len(results.get("positions", []))
        open_positions += sum(1 for p in results.get("positions", []) if p.get("is_open"))

    win_rate = (winning_trades / total_trades * 100) if total_trades else 0.0
    return {
        "total_pnl": round(total_pnl, 2),
        "realized_pnl": round(realized_pnl, 2),
        "unrealized_pnl": 0.0,
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": round(win_rate, 2),
        "total_positions": all_positions,
        "open_positions": open_positions,
    }


@router.get("/trades")
async def list_trades(limit: int = 20):
    all_trades = []
    for results in nautilus_system.backtest_results.values():
        for order in results.get("orders", []):
            row = normalize_order(order)
            row["timestamp"] = datetime.now(timezone.utc).isoformat()
            all_trades.append(row)
    return {"trades": all_trades[:limit], "count": len(all_trades)}


@router.get("/instruments")
async def list_instruments():
    instruments = []
    for instr in nautilus_system.instruments:
        instruments.append(
            {
                "id": str(instr.id),
                "symbol": str(instr.id.symbol),
                "venue": str(instr.id.venue),
            }
        )
    if not instruments:
        instruments = [
            {"id": "EUR/USD.SIM",    "symbol": "EUR/USD",  "venue": "SIM"},
            {"id": "GBP/USD.SIM",    "symbol": "GBP/USD",  "venue": "SIM"},
            {"id": "USD/JPY.SIM",    "symbol": "USD/JPY",  "venue": "SIM"},
            {"id": "AUD/USD.SIM",    "symbol": "AUD/USD",  "venue": "SIM"},
            {"id": "BTCUSDT.BINANCE","symbol": "BTCUSDT",  "venue": "BINANCE"},
            {"id": "ETHUSDT.BINANCE","symbol": "ETHUSDT",  "venue": "BINANCE"},
        ]
    return {"instruments": instruments, "count": len(instruments)}
