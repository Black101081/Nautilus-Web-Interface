"""
Backtest Router
===============
Handles /api/nautilus/* endpoints (backtest, demo-backtest, system-info, etc.).
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from nautilus_core import NautilusTradingSystem

router = APIRouter()

_nautilus_system: Optional[NautilusTradingSystem] = None


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


def _get_system() -> NautilusTradingSystem:
    if _nautilus_system is None:
        raise HTTPException(status_code=503, detail="Trading system not initialized")
    return _nautilus_system


# ─── Pydantic models ──────────────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    strategy_id: str
    start_date: str = "2020-01-01"
    end_date: str = "2020-01-31"
    starting_balance: float = 100000.0


class DemoBacktestRequest(BaseModel):
    fast_period: int = 10
    slow_period: int = 20
    starting_balance: float = 100000.0
    num_bars: int = 500


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/nautilus/initialize")
async def initialize_system():
    """Initialize Nautilus Trading System."""
    result = _get_system().initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/api/nautilus/system-info")
async def get_system_info():
    """Get system information."""
    return _get_system().get_system_info()


@router.post("/api/nautilus/backtest")
async def run_backtest(request: BacktestRequest):
    """Run a backtest."""
    result = _get_system().run_backtest(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        starting_balance=request.starting_balance,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/api/nautilus/backtest/{strategy_id}")
async def get_backtest_results(strategy_id: str):
    """Get backtest results for a strategy."""
    results = _get_system().get_backtest_results(strategy_id)
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No backtest results found for strategy {strategy_id}",
        )
    return {"success": True, "results": results}


@router.post("/api/nautilus/demo-backtest")
async def run_demo_backtest(request: DemoBacktestRequest):
    """Run a demo backtest using synthetic data – no data catalog required."""
    result = _get_system().run_demo_backtest(
        fast_period=request.fast_period,
        slow_period=request.slow_period,
        starting_balance=request.starting_balance,
        num_bars=request.num_bars,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("message", "Demo backtest failed"))
    return result


@router.get("/api/engine/info")
async def get_engine_info():
    """Engine status for AdminDashboard."""
    system = _get_system()
    info = system.get_system_info()
    return {
        "trader_id": info["trader_id"],
        "status": "running" if info["is_initialized"] else "initializing",
        "engine_type": "BacktestEngine",
        "is_running": info["is_initialized"],
        "strategies_count": info["strategies_count"],
        "backtests_count": info.get("backtests_count", len(system.backtest_results)),
        "is_initialized": info["is_initialized"],
        "catalog_path": info["catalog_path"],
        "uptime": "active",
    }


@router.get("/api/instruments")
async def list_instruments():
    """List available instruments from catalog (falls back to demo list)."""
    system = _get_system()
    instruments = [
        {"id": str(instr.id), "symbol": str(instr.id.symbol), "venue": str(instr.id.venue)}
        for instr in system.instruments
    ]
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


@router.get("/api/performance/summary")
async def get_performance_summary():
    """Aggregate performance summary across all backtests."""
    system = _get_system()
    total_pnl = 0.0
    realized_pnl = 0.0
    total_trades = 0
    winning_trades = 0
    losing_trades = 0
    all_positions = 0
    open_positions = 0

    for results in system.backtest_results.values():
        total_pnl += results.get("total_pnl", 0.0)
        realized_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
        winning_trades += results.get("winning_trades", 0)
        losing_trades += results.get("losing_trades", 0)
        all_positions += len(results.get("positions", []))
        open_positions += len([p for p in results.get("positions", []) if p.get("is_open", False)])

    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

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


@router.get("/api/trades")
async def list_trades(limit: int = 20):
    """List trades from all backtests."""
    system = _get_system()
    all_trades = []
    for results in system.backtest_results.values():
        for order in results.get("orders", []):
            side_raw = str(order.get("side", ""))
            side = "BUY" if "BUY" in side_raw else "SELL" if "SELL" in side_raw else side_raw
            status_raw = str(order.get("status", ""))
            status = "FILLED" if "FILLED" in status_raw else status_raw
            all_trades.append({
                "id": order.get("id", ""),
                "instrument": order.get("instrument_id", ""),
                "side": side,
                "quantity": order.get("quantity", 0),
                "price": order.get("avg_px"),
                "status": status,
                "filled_qty": order.get("filled_qty", 0),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    return {"trades": all_trades[:limit], "count": len(all_trades)}
