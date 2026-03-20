"""
Strategies router — full CRUD with SQLite persistence.
Supports: sma_crossover, rsi, macd
"""

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

import database
from auth_jwt import get_current_user
import state as _state
from live_node import build_live_strategy


def _nautilus():
    """Accessor so tests can patch state.nautilus_system at runtime."""
    return _state.nautilus_system

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
    "macd": {
        "label": "MACD Crossover",
        "description": "Buy when MACD line crosses above signal line, sell on cross-down.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "fast_period": 12,
            "slow_period": 26,
            "signal_period": 9,
            "trade_size": "100000",
        },
    },
    "ema_crossover": {
        "label": "EMA Crossover",
        "description": "Buy when fast EMA crosses above slow EMA (more responsive than SMA).",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "fast_period": 9,
            "slow_period": 21,
            "trade_size": "100000",
        },
    },
    "bollinger_bands": {
        "label": "Bollinger Bands",
        "description": "Mean-reversion: buy at lower band, sell at upper band, exit at mid.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "period": 20,
            "std_dev": 2.0,
            "trade_size": "100000",
        },
    },
    "vwap": {
        "label": "VWAP",
        "description": "Mean-reversion using rolling VWAP: buy below, sell above, exit at VWAP.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "vwap_period": 20,
            "deviation_pct": 0.5,
            "trade_size": "100000",
        },
    },
    "custom": {
        "label": "Custom Strategy",
        "description": "Upload your own Nautilus Trader strategy Python file.",
        "default_config": {
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
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
    """Convert a DB row into the dict shape used by _nautilus().strategies."""
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
    """Called at startup to restore persisted strategies into _nautilus()."""
    rows = await database.list_strategies()
    for row in rows:
        sid = row["id"]
        if sid not in _nautilus().strategies:
            s = _db_row_to_strategy(row)
            _nautilus().strategies[sid] = s
            # Register with NautilusTrader engine (SMA and RSI supported)
            if s["type"] in ("sma_crossover", "rsi", "macd", "ema_crossover", "bollinger_bands", "vwap"):
                cfg = s["config"]
                _nautilus().create_strategy({
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
                if sid in _nautilus().strategies:
                    _nautilus().strategies[sid]["status"] = s["status"]


# ── Strategy types metadata endpoint ─────────────────────────────────────────

@router.get("/strategy-types")
async def list_strategy_types():
    types_list = [{"id": k, **v} for k, v in _STRATEGY_TYPES.items()]
    return {"types": types_list, "strategy_types": types_list}


# ── Nautilus native endpoints ─────────────────────────────────────────────────

@router.get("/nautilus/strategies")
async def nautilus_list_strategies():
    strategies = _nautilus().get_all_strategies()
    return {"success": True, "strategies": strategies, "count": len(strategies)}


@router.get("/nautilus/strategies/{strategy_id}")
async def nautilus_get_strategy(strategy_id: str):
    strategy = _nautilus().get_strategy(strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    return {"success": True, "strategy": strategy}


@router.post("/nautilus/strategies")
async def nautilus_create_strategy(request: StrategyCreateRequest, _user: dict = Depends(get_current_user)):
    result = _nautilus().create_strategy(request.model_dump())
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


# ── UI-facing endpoints ───────────────────────────────────────────────────────

@router.get("/strategies")
async def list_strategies():
    # Check daily loss limit and auto-stop running strategies if exceeded
    try:
        from risk_engine import risk_engine
        await risk_engine.check_daily_loss_auto_stop()
    except Exception:
        pass  # Never fail the list endpoint due to risk check errors
    strategies = _nautilus().get_all_strategies()
    result = []
    for strategy in strategies:
        br = _nautilus().get_backtest_results(strategy["id"])
        cfg = strategy.get("config") or {}
        if hasattr(cfg, "instrument_id"):
            instrument = str(cfg.instrument_id)
        elif isinstance(cfg, dict):
            instrument = cfg.get("instrument_id", "EUR/USD.SIM")
        else:
            instrument = "EUR/USD.SIM"
        # Merge backtest results with live DB orders for up-to-date performance
        db_orders = await database.list_orders()
        filled_orders = [o for o in db_orders if o.get("status") == "filled"]
        db_pnl = sum(float(o.get("pnl") or 0) for o in filled_orders)
        db_trades = len(filled_orders)
        total_pnl = br.get("total_pnl", 0.0) if br else 0.0
        total_trades = br.get("total_trades", 0) if br else 0
        # Use DB values if greater (live orders supplement backtest)
        if db_pnl != 0.0 or db_trades > 0:
            total_pnl = db_pnl
            total_trades = db_trades
        result.append(
            {
                "id": strategy["id"],
                "name": strategy["name"],
                "type": strategy["type"],
                "status": strategy["status"],
                "description": strategy.get("description", ""),
                "instrument": instrument,
                "performance": {
                    "total_pnl": total_pnl,
                    "total_trades": total_trades,
                    "win_rate": (br.get("win_rate", 0.0) / 100.0) if br else 0.0,
                },
            }
        )
    return {"strategies": result, "count": len(result)}


@router.post("/strategies")
async def create_strategy(body: Dict[str, Any] = Body(...), _user: dict = Depends(get_current_user)):
    strategy_type = body.get("type", "sma_crossover")
    if strategy_type not in _STRATEGY_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown strategy type: {strategy_type}")

    name = body.get("name", "")
    if not name or not str(name).strip():
        raise HTTPException(status_code=422, detail="'name' is required and must not be empty")

    # SMA period validation
    if strategy_type == "sma_crossover":
        fast = int(body.get("fast_period") or 10)
        slow = int(body.get("slow_period") or 20)
        if fast >= slow:
            raise HTTPException(
                status_code=422,
                detail=f"fast_period ({fast}) must be less than slow_period ({slow})",
            )

    # RSI validation
    if strategy_type == "rsi":
        rsi_period = int(body.get("rsi_period") or 14)
        oversold = float(body.get("oversold_level") or 30.0)
        overbought = float(body.get("overbought_level") or 70.0)
        if rsi_period < 2:
            raise HTTPException(status_code=422, detail="rsi_period must be >= 2")
        if oversold >= overbought:
            raise HTTPException(
                status_code=422,
                detail=f"oversold_level ({oversold}) must be less than overbought_level ({overbought})",
            )

    # MACD validation
    if strategy_type == "macd":
        fast = int(body.get("fast_period") or 12)
        slow = int(body.get("slow_period") or 26)
        if fast >= slow:
            raise HTTPException(
                status_code=422,
                detail=f"MACD fast_period ({fast}) must be less than slow_period ({slow})",
            )

    # EMA validation
    if strategy_type == "ema_crossover":
        fast = int(body.get("fast_period") or 9)
        slow = int(body.get("slow_period") or 21)
        if fast >= slow:
            raise HTTPException(
                status_code=422,
                detail=f"EMA fast_period ({fast}) must be less than slow_period ({slow})",
            )

    # Bollinger Bands validation
    if strategy_type == "bollinger_bands":
        period = int(body.get("period") or 20)
        std_dev = float(body.get("std_dev") or 2.0)
        if period < 2:
            raise HTTPException(status_code=422, detail="Bollinger period must be >= 2")
        if std_dev <= 0:
            raise HTTPException(status_code=422, detail="std_dev must be > 0")

    # VWAP validation
    if strategy_type == "vwap":
        vwap_period = int(body.get("vwap_period") if body.get("vwap_period") is not None else 20)
        deviation_pct_raw = body.get("deviation_pct")
        deviation_pct = float(deviation_pct_raw) if deviation_pct_raw is not None else 0.5
        if vwap_period < 2:
            raise HTTPException(status_code=422, detail="vwap_period must be >= 2")
        if deviation_pct <= 0:
            raise HTTPException(status_code=422, detail="deviation_pct must be > 0")

    defaults = _STRATEGY_TYPES[strategy_type]["default_config"].copy()
    sid = body.get("id") or f"STR-{uuid.uuid4().hex[:8].upper()}"
    description = body.get("description", _STRATEGY_TYPES[strategy_type]["description"])

    # Build config from request body, falling back to defaults for missing/null values
    config = {k: (body.get(k) if body.get(k) is not None else defaults[k]) for k in defaults}

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
    result = _nautilus().create_strategy({**config, "id": sid, "name": name, "type": strategy_type})
    # Validate result is a real dict with a string strategy_id (guards against MagicMock in tests)
    result_sid = result.get("strategy_id") if isinstance(result, dict) else None
    if result_sid and isinstance(result_sid, str) and result.get("success"):
        actual_sid = result_sid
        # If nautilus assigned a different ID, update DB
        if actual_sid != sid:
            strategy_row["id"] = actual_sid
            await database.delete_strategy(sid)
            await database.save_strategy(strategy_row)
        sys = _nautilus()
        if hasattr(sys, "strategies") and isinstance(sys.strategies, dict) and actual_sid in sys.strategies:
            sys.strategies[actual_sid]["description"] = description
            sys.strategies[actual_sid]["status"] = "stopped"
        return {"success": True, "strategy_id": actual_sid, "strategy": strategy_row}

    return {"success": True, "strategy_id": sid, "strategy": strategy_row}


@router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str, _user: dict = Depends(get_current_user)):
    if not await _strategy_exists(strategy_id):
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    sys = _nautilus()
    if hasattr(sys, "strategies") and isinstance(sys.strategies, dict) and strategy_id in sys.strategies:
        del sys.strategies[strategy_id]
    await database.delete_strategy(strategy_id)
    return {"success": True, "message": f"Strategy {strategy_id} deleted"}


async def _strategy_exists(strategy_id: str) -> bool:
    """Check if a strategy exists — in-memory first, DB as fallback."""
    sys = _nautilus()
    if hasattr(sys, "strategies") and isinstance(sys.strategies, dict):
        if strategy_id in sys.strategies:
            return True
    # Fallback: check DB (handles mocked nautilus_system in tests)
    rows = await database.list_strategies()
    return any(r["id"] == strategy_id for r in rows)


@router.post("/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str, _user: dict = Depends(get_current_user)):
    if not await _strategy_exists(strategy_id):
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")

    _nautilus().start_strategy(strategy_id)
    await database.update_strategy_status(strategy_id, "running")

    # ── TradingNode integration ──────────────────────────────────────────────
    node_started = False
    node = _state.live_node
    if node.is_connected():
        if node.start_strategy(strategy_id):
            node_started = True
        else:
            # Strategy not yet registered with node — build and register it
            rows = await database.list_strategies()
            row = next((r for r in rows if r["id"] == strategy_id), None)
            if row:
                import json as _json
                cfg = {}
                try:
                    cfg = _json.loads(row.get("config", "{}"))
                except Exception:
                    pass
                strategy_instance = build_live_strategy(
                    strategy_type=row["type"],
                    strategy_id=strategy_id,
                    config=cfg,
                )
                if strategy_instance:
                    await node.rebuild_with_new_strategy(strategy_id, strategy_instance)
                    node_started = node.is_connected()

    return {
        "success": True,
        "message": f"Strategy {strategy_id} started",
        "live_engine_registered": True,
        "node_started": node_started,
    }


@router.post("/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str, _user: dict = Depends(get_current_user)):
    if not await _strategy_exists(strategy_id):
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")

    _nautilus().stop_strategy(strategy_id)
    await database.update_strategy_status(strategy_id, "stopped")

    # ── TradingNode integration ──────────────────────────────────────────────
    node = _state.live_node
    if node.is_connected():
        node.stop_strategy(strategy_id)

    return {
        "success": True,
        "message": f"Strategy {strategy_id} stopped",
        "live_engine_registered": False,
    }


# ── Custom strategy upload ─────────────────────────────────────────────────────

_CUSTOM_STRATEGIES_DIR = os.path.join(os.path.dirname(__file__), "..", "custom_strategies")


@router.post("/strategies/upload")
async def upload_custom_strategy(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    """
    Upload a custom Nautilus Trader strategy Python file.

    The file must be a valid .py file. It is stored in backend/custom_strategies/
    and registered as a 'custom' type strategy available for backtesting.
    """
    if not file.filename or not file.filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only .py files are accepted")

    # Read and basic-validate content
    content = await file.read()
    if len(content) > 512 * 1024:  # 512 KB limit
        raise HTTPException(status_code=400, detail="File too large (max 512 KB)")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    # Require at least one Strategy subclass marker
    if "Strategy" not in text:
        raise HTTPException(
            status_code=400,
            detail="File does not appear to contain a Nautilus Strategy subclass",
        )

    os.makedirs(_CUSTOM_STRATEGIES_DIR, exist_ok=True)

    # Sanitize filename
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in ("_", "-", "."))
    dest_path = os.path.join(_CUSTOM_STRATEGIES_DIR, safe_name)

    with open(dest_path, "wb") as f:
        f.write(content)

    sid = f"CUSTOM-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    strategy_row = {
        "id": sid,
        "name": safe_name.replace(".py", ""),
        "type": "custom",
        "status": "stopped",
        "description": f"Custom strategy uploaded from {file.filename}",
        "config": {
            "file": safe_name,
            "instrument_id": "EUR/USD.SIM",
            "bar_type": "EUR/USD.SIM-1-MINUTE-BID-INTERNAL",
            "trade_size": "100000",
        },
        "created_at": now,
        "updated_at": now,
    }
    await database.save_strategy(strategy_row)

    return {
        "success": True,
        "strategy_id": sid,
        "filename": safe_name,
        "message": f"Custom strategy '{safe_name}' uploaded and registered.",
    }
