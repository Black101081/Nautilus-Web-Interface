from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from state import nautilus_system

router = APIRouter(prefix="/api", tags=["strategies"])


class StrategyCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100)
    type: str = "sma_crossover"
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    fast_period: int = Field(10, ge=1, le=500)
    slow_period: int = Field(20, ge=1, le=500)
    trade_size: str = "100000"


# ── Nautilus native endpoints ────────────────────────────────────────────────


@router.get("/nautilus/strategies")
async def nautilus_list_strategies():
    strategies = nautilus_system.get_all_strategies()
    return {"success": True, "strategies": strategies, "count": len(strategies)}


@router.get("/nautilus/strategies/{strategy_id}")
async def nautilus_get_strategy(strategy_id: str):
    strategy = nautilus_system.get_strategy(strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    return {"success": True, "strategy": strategy}


@router.post("/nautilus/strategies")
async def nautilus_create_strategy(request: StrategyCreateRequest):
    result = nautilus_system.create_strategy(request.model_dump())
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


# ── UI-facing endpoints (used by StrategiesPage) ─────────────────────────────


@router.get("/strategies")
async def list_strategies():
    strategies = nautilus_system.get_all_strategies()
    result = []
    for strategy in strategies:
        br = nautilus_system.get_backtest_results(strategy["id"])
        cfg = strategy.get("config") or {}
        result.append(
            {
                "id": strategy["id"],
                "name": strategy["name"],
                "type": strategy["type"],
                "status": strategy["status"],
                "description": strategy.get("description", "SMA Crossover strategy"),
                "instrument": cfg.get("instrument_id", "EUR/USD.SIM"),
                "performance": {
                    "total_pnl": br.get("total_pnl", 0.0) if br else 0.0,
                    "total_trades": br.get("total_trades", 0) if br else 0,
                    # Normalise to 0-1 decimal (StrategiesPage expects this)
                    "win_rate": (br.get("win_rate", 0.0) / 100.0) if br else 0.0,
                },
            }
        )
    return {"strategies": result, "count": len(result)}


@router.post("/strategies")
async def create_strategy(body: Dict[str, Any] = Body(...)):
    config = {
        "name": body.get("name", "New Strategy"),
        "type": "sma_crossover",
        "instrument_id": "EUR/USD.SIM",
        "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
        "fast_period": 10,
        "slow_period": 20,
        "trade_size": "100000",
    }
    result = nautilus_system.create_strategy(config)
    if result.get("success") and result.get("strategy_id"):
        sid = result["strategy_id"]
        if sid in nautilus_system.strategies:
            nautilus_system.strategies[sid]["description"] = body.get("description", "")
    return result


@router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    del nautilus_system.strategies[strategy_id]
    return {"success": True, "message": f"Strategy {strategy_id} deleted"}


@router.post("/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    nautilus_system.strategies[strategy_id]["status"] = "running"
    return {"success": True, "message": f"Strategy {strategy_id} started"}


@router.post("/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    nautilus_system.strategies[strategy_id]["status"] = "stopped"
    return {"success": True, "message": f"Strategy {strategy_id} stopped"}
