"""
Risk Router
===========
Handles /api/risk/* endpoints with SQLite persistence.
"""

from typing import Any, Dict

from fastapi import APIRouter, Body
from pydantic import BaseModel

import database
from nautilus_core import NautilusTradingSystem
from typing import Optional

router = APIRouter()

_nautilus_system: Optional[NautilusTradingSystem] = None


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


@router.get("/api/risk/limits")
async def get_risk_limits():
    """Return current risk limit configuration."""
    return await database.get_risk_limits()


@router.post("/api/risk/limits")
async def update_risk_limits(limits: Dict[str, Any] = Body(...)):
    """Update risk limits (persisted to SQLite)."""
    await database.save_risk_limits(limits)
    return {"success": True, "limits": await database.get_risk_limits()}


@router.get("/api/risk/metrics")
async def get_risk_metrics():
    """Aggregate risk metrics from all backtests."""
    total_pnl = 0.0
    total_trades = 0
    max_drawdown = 0.0
    sharpe_ratio = 0.0

    system = _nautilus_system
    if system:
        for results in system.backtest_results.values():
            total_pnl += results.get("total_pnl", 0.0)
            total_trades += results.get("total_trades", 0)
            if results.get("max_drawdown", 0.0) > max_drawdown:
                max_drawdown = results.get("max_drawdown", 0.0)
            if results.get("sharpe_ratio", 0.0) > sharpe_ratio:
                sharpe_ratio = results.get("sharpe_ratio", 0.0)

    return {
        "total_exposure": 0.0,
        "var_95": 0.0,
        "max_drawdown": max_drawdown,
        "sharpe_ratio": sharpe_ratio,
        "total_pnl": total_pnl,
        "total_trades": total_trades,
    }
