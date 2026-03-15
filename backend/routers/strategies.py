"""
Strategies router — full CRUD with SQLite persistence.
Supports: sma_crossover, rsi
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

import database
from state import nautilus_system

router = APIRouter(prefix="/api", tags=["strategies"])

# ── Supported strategy types ──────────────────────────────────────────────────

_STRATEGY_TYPES = {
    "sma_crossover": {
        "label": "SMA Crossover",
        "description": "Buy when fast SMA crosses above slow SMA, sell on cross-down.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "fast_period": 10,
            "slow_period": 20,
            "trade_size": "100000",
        },
    },
    "rsi": {
        "label": "RSI Mean-Reversion",
        "description": "Enter long on RSI oversold cross-up, short on overbought cross-down.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "rsi_period": 14,
            "oversold_level": 30.0,
            "overbought_level": 70.0,
            "trade_size": "100000",
        },
    },
}


class StrategyCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100)
    type: str = "sma_crossover"
    description: str = ""
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    # SMA params
    fast_period: int = Field(10, ge=1, le=500)
    slow_period: int = Field(20, ge=1, le=500)
    # RSI params
    rsi_period: int = Field(14, ge=2, le=200)
    oversold_level: float = Field(30.0, ge=1, le=49)
    overbought_level: float = Field(70.0, ge=51, le=99)
    trade_size: str = "100000"


def _db_row_to_strategy(row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a DB row into the dict shape used by nautilus_system.strategies."""
    cfg = {}
    try:
        cfg = json.loads(row.get("config", "{}"))
    except Exception:
        pass
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "status": row.get("status", "stopped"),
        "description": row.get("description", ""),
        "config": cfg,
    }


async def load_strategies_from_db() -> None:
    """Called at startup to restore persisted strategies into nautilus_system."""
    rows = await database.list_strategies()
    for row in rows:
        sid = row["id"]
        if sid not in nautilus_system.strategies:
            s = _db_row_to_strategy(row)
            nautilus_system.strategies[sid] = s
            # Register with NautilusTrader engine (SMA and RSI supported)
            if s["type"] in ("sma_crossover", "rsi"):
                cfg = s["config"]
                nautilus_system.create_strategy({
                    "id": sid,
                    "name": s["name"],
                    "type": s["type"],
                    # common
                    "instrument_id": cfg.get("instrument_id", "EUR/USD.SIM"),
                    "bar_type": cfg.get("bar_type", "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"),
                    "trade_size": cfg.get("trade_size", "100000"),
                    # SMA params
                    "fast_period": cfg.get("fast_period", 10),
                    "slow_period": cfg.get("slow_period", 20),
                    # RSI params
                    "rsi_period": cfg.get("rsi_period", 14),
                    "oversold_level": cfg.get("oversold_level", 30.0),
                    "overbought_level": cfg.get("overbought_level", 70.0),
                })
                # Restore the persisted status after create (create sets to 'created')
                if sid in nautilus_system.strategies:
                    nautilus_system.strategies[sid]["status"] = s["status"]


# ── Strategy types metadata endpoint ─────────────────────────────────────────

@router.get("/strategy-types")
async def list_strategy_types():
    return {"types": [{"id": k, **v} for k, v in _STRATEGY_TYPES.items()]}


# ── Nautilus native endpoints ─────────────────────────────────────────────────

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


# ── UI-facing endpoints ───────────────────────────────────────────────────────

@router.get("/strategies")
async def list_strategies():
    strategies = nautilus_system.get_all_strategies()
    result = []
    for strategy in strategies:
        br = nautilus_system.get_backtest_results(strategy["id"])
        cfg = strategy.get("config") or {}
        if hasattr(cfg, "instrument_id"):
            instrument = str(cfg.instrument_id)
        elif isinstance(cfg, dict):
            instrument = cfg.get("instrument_id", "EUR/USD.SIM")
        else:
            instrument = "EUR/USD.SIM"
        result.append(
            {
                "id": strategy["id"],
                "name": strategy["name"],
                "type": strategy["type"],
                "status": strategy["status"],
                "description": strategy.get("description", ""),
                "instrument": instrument,
                "performance": {
                    "total_pnl": br.get("total_pnl", 0.0) if br else 0.0,
                    "total_trades": br.get("total_trades", 0) if br else 0,
                    "win_rate": (br.get("win_rate", 0.0) / 100.0) if br else 0.0,
                },
            }
        )
    return {"strategies": result, "count": len(result)}


@router.post("/strategies")
async def create_strategy(body: Dict[str, Any] = Body(...)):
    strategy_type = body.get("type", "sma_crossover")
    if strategy_type not in _STRATEGY_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown strategy type: {strategy_type}")

    # SMA period validation
    if strategy_type == "sma_crossover":
        fast = int(body.get("fast_period", 10))
        slow = int(body.get("slow_period", 20))
        if fast >= slow:
            raise HTTPException(
                status_code=422,
                detail=f"fast_period ({fast}) must be less than slow_period ({slow})",
            )

    defaults = _STRATEGY_TYPES[strategy_type]["default_config"].copy()
    sid = body.get("id") or f"STR-{uuid.uuid4().hex[:8].upper()}"
    name = body.get("name", "New Strategy")
    description = body.get("description", _STRATEGY_TYPES[strategy_type]["description"])

    # Build config from request body, falling back to defaults
    config = {k: body.get(k, defaults[k]) for k in defaults}

    now = datetime.now(timezone.utc).isoformat()
    strategy_row = {
        "id": sid,
        "name": name,
        "type": strategy_type,
        "status": "stopped",
        "description": description,
        "config": config,
        "created_at": now,
        "updated_at": now,
    }

    # Persist to DB
    await database.save_strategy(strategy_row)

    # Register with Nautilus engine (supports sma_crossover and rsi)
    result = nautilus_system.create_strategy({**config, "id": sid, "name": name, "type": strategy_type})
    if result.get("success") and result.get("strategy_id"):
        actual_sid = result["strategy_id"]
        # If nautilus assigned a different ID, update DB
        if actual_sid != sid:
            strategy_row["id"] = actual_sid
            await database.delete_strategy(sid)
            await database.save_strategy(strategy_row)
        if actual_sid in nautilus_system.strategies:
            nautilus_system.strategies[actual_sid]["description"] = description
            nautilus_system.strategies[actual_sid]["status"] = "stopped"
        return {"success": True, "strategy_id": actual_sid, "strategy": strategy_row}

    return {"success": True, "strategy_id": sid, "strategy": strategy_row}


@router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    del nautilus_system.strategies[strategy_id]
    await database.delete_strategy(strategy_id)
    return {"success": True, "message": f"Strategy {strategy_id} deleted"}


@router.post("/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    nautilus_system.strategies[strategy_id]["status"] = "running"
    await database.update_strategy_status(strategy_id, "running")
    return {"success": True, "message": f"Strategy {strategy_id} started"}


@router.post("/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    if strategy_id not in nautilus_system.strategies:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    nautilus_system.strategies[strategy_id]["status"] = "stopped"
    await database.update_strategy_status(strategy_id, "stopped")
    return {"success": True, "message": f"Strategy {strategy_id} stopped"}
