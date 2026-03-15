"""
Strategies Router
=================
Handles /api/strategies/* and /api/nautilus/strategies/* endpoints.
"""

import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from nautilus_core import NautilusTradingSystem

router = APIRouter()

# Shared reference set by the main app at startup
_nautilus_system: Optional[NautilusTradingSystem] = None


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


def _get_system() -> NautilusTradingSystem:
    if _nautilus_system is None:
        raise HTTPException(status_code=503, detail="Trading system not initialized")
    return _nautilus_system


# ─── Pydantic models ──────────────────────────────────────────────────────────

class StrategyCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str
    type: str = "sma_crossover"
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    fast_period: int = 10
    slow_period: int = 20
    trade_size: str = "100000"


# ─── Nautilus-namespace endpoints ─────────────────────────────────────────────

@router.post("/api/nautilus/strategies")
async def nautilus_create_strategy(request: StrategyCreateRequest):
    """Create a new trading strategy (Nautilus namespace)."""
    config = request.model_dump()
    result = _get_system().create_strategy(config)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/api/nautilus/strategies")
async def nautilus_list_strategies():
    """List all strategies (Nautilus namespace)."""
    strategies = _get_system().get_all_strategies()
    return {"success": True, "strategies": strategies, "count": len(strategies)}


@router.get("/api/nautilus/strategies/{strategy_id}")
async def nautilus_get_strategy(strategy_id: str):
    """Get a specific strategy (Nautilus namespace)."""
    strategy = _get_system().get_strategy(strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    return {"success": True, "strategy": strategy}


# ─── Legacy / UI endpoints ────────────────────────────────────────────────────

@router.get("/api/strategies")
async def list_strategies():
    """List strategies – {strategies:[...]} format for StrategiesPage."""
    system = _get_system()
    strategies = system.get_all_strategies()
    result = []
    for strategy in strategies:
        br = system.get_backtest_results(strategy["id"])
        cfg = strategy.get("config")
        result.append({
            "id": strategy["id"],
            "name": strategy["name"],
            "type": strategy["type"],
            "status": strategy["status"],
            "description": strategy.get("description", "SMA Crossover strategy"),
            "instrument": cfg.get("instrument_id", "EUR/USD.SIM") if cfg else "EUR/USD.SIM",
            "performance": {
                "total_pnl": br.get("total_pnl", 0.0) if br else 0.0,
                "total_trades": br.get("total_trades", 0) if br else 0,
                "win_rate": (br.get("win_rate", 0.0) / 100.0) if br else 0.0,
            },
        })
    return {"strategies": result, "count": len(result)}


@router.post("/api/strategies")
async def create_strategy_ui(request_body: Dict[str, Any] = Body(...)):
    """Create strategy from StrategiesPage UI."""
    system = _get_system()
    config = {
        "name": request_body.get("name", "New Strategy"),
        "type": "sma_crossover",
        "instrument_id": "EUR/USD.SIM",
        "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
        "fast_period": 10,
        "slow_period": 20,
        "trade_size": "100000",
    }
    result = system.create_strategy(config)
    if result.get("success") and result.get("strategy_id"):
        sid = result["strategy_id"]
        if sid in system.strategies:
            system.strategies[sid]["description"] = request_body.get("description", "")
    return result


@router.delete("/api/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    system = _get_system()
    if strategy_id in system.strategies:
        del system.strategies[strategy_id]
        return {"success": True, "message": f"Strategy {strategy_id} deleted"}
    raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")


@router.post("/api/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    system = _get_system()
    if strategy_id not in system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    system.strategies[strategy_id]["status"] = "running"
    return {"success": True, "message": f"Strategy {strategy_id} started"}


@router.post("/api/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    system = _get_system()
    if strategy_id not in system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    system.strategies[strategy_id]["status"] = "stopped"
    return {"success": True, "message": f"Strategy {strategy_id} stopped"}
