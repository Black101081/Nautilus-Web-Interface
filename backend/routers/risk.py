from typing import Any, Dict

from fastapi import APIRouter, Body

import database
from state import nautilus_system

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/limits")
async def get_risk_limits():
    return await database.get_risk_limits()


@router.post("/limits")
async def update_risk_limits(body: Dict[str, Any] = Body(...)):
    limits = await database.update_risk_limits(body)
    return {"success": True, "limits": limits}


@router.get("/metrics")
async def get_risk_metrics():
    total_pnl = 0.0
    total_trades = 0
    max_drawdown = 0.0
    sharpe_ratio = 0.0

    for results in nautilus_system.backtest_results.values():
        total_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
        if results.get("max_drawdown", 0.0) > max_drawdown:
            max_drawdown = results["max_drawdown"]
        if results.get("sharpe_ratio", 0.0) > sharpe_ratio:
            sharpe_ratio = results["sharpe_ratio"]

    return {
        "total_exposure": 0.0,
        "var_95": 0.0,
        "max_drawdown": max_drawdown,
        "sharpe_ratio": sharpe_ratio,
        "total_pnl": total_pnl,
        "total_trades": total_trades,
    }
