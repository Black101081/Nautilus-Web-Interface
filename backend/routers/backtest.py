import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

import database
from auth_jwt import get_current_user
from state import nautilus_system, manager
import data_loader

router = APIRouter(prefix="/api/nautilus", tags=["backtest"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_backtest_lock = False  # simple flag; asyncio is single-threaded so no race condition


def _validate_date(value: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError("Date must be in YYYY-MM-DD format")
    return value


class BacktestRequest(BaseModel):
    strategy_id: str
    start_date: str = "2020-01-01"
    end_date: str = "2020-01-31"
    starting_balance: float = Field(100_000.0, gt=0)

    @field_validator("start_date", "end_date")
    @classmethod
    def check_date_format(cls, v: str) -> str:
        return _validate_date(v)

    @field_validator("end_date")
    @classmethod
    def check_end_after_start(cls, v: str, info) -> str:
        start = info.data.get("start_date", "")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v


class DemoBacktestRequest(BaseModel):
    fast_period: int = Field(10, ge=1, le=500)
    slow_period: int = Field(20, ge=1, le=500)
    starting_balance: float = Field(100_000.0, gt=0)
    num_bars: int = Field(500, ge=10, le=10_000)

    @field_validator("slow_period")
    @classmethod
    def check_slow_gt_fast(cls, v: int, info) -> int:
        fast = info.data.get("fast_period", 0)
        if v <= fast:
            raise ValueError("slow_period must be greater than fast_period")
        return v


@router.post("/backtest")
async def run_backtest(request: BacktestRequest, _user: dict = Depends(get_current_user)):
    global _backtest_lock
    if _backtest_lock:
        raise HTTPException(status_code=409, detail="A backtest is already running. Please wait.")
    _backtest_lock = True
    try:
        # ── Auto-download data if not in catalog ─────────────────────────────
        strategy = nautilus_system.strategies.get(request.strategy_id)
        if strategy:
            cfg = strategy.get("config") or {}
            instrument_id = (
                cfg.get("instrument_id") if isinstance(cfg, dict)
                else getattr(cfg, "instrument_id", None)
            ) or "EUR/USD.SIM"
            # Only auto-download for Binance symbols (not SIM)
            if ".SIM" not in instrument_id and "BINANCE" in instrument_id.upper():
                symbol = instrument_id.split(".")[0]
                catalog_path = nautilus_system.catalog_path
                success, msg = await data_loader.ensure_data_available(
                    symbol=symbol,
                    interval="1m",
                    start_date=request.start_date,
                    end_date=request.end_date,
                    catalog_path=catalog_path,
                )
                if not success:
                    # Log warning but continue — catalog may already have data
                    import logging as _logging
                    _logging.getLogger(__name__).warning(
                        "Auto-download failed for %s: %s", symbol, msg
                    )

        result = nautilus_system.run_backtest(
            strategy_id=request.strategy_id,
            start_date=request.start_date,
            end_date=request.end_date,
            starting_balance=request.starting_balance,
        )
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])
        positions = result.get("result", {}).get("positions", [])
        if positions:
            await database.save_positions(positions, strategy_id=request.strategy_id)
        return result
    finally:
        _backtest_lock = False


@router.get("/backtest/{strategy_id}")
async def get_backtest_results(strategy_id: str):
    results = nautilus_system.get_backtest_results(strategy_id)
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No backtest results found for strategy {strategy_id}",
        )
    return {"success": True, "results": results}


@router.post("/demo-backtest")
async def run_demo_backtest(request: DemoBacktestRequest, _user: dict = Depends(get_current_user)):
    global _backtest_lock
    if _backtest_lock:
        raise HTTPException(status_code=409, detail="A backtest is already running. Please wait.")
    _backtest_lock = True
    try:
        result = nautilus_system.run_demo_backtest(
            fast_period=request.fast_period,
            slow_period=request.slow_period,
            starting_balance=request.starting_balance,
            num_bars=request.num_bars,
        )
        if not result["success"]:
            raise HTTPException(
                status_code=500, detail=result.get("message", "Demo backtest failed")
            )
        demo_positions = result.get("result", {}).get("positions", [])
        if demo_positions:
            await database.save_positions(demo_positions, strategy_id="demo")
        await manager.broadcast(
            {
                "type": "backtest_complete",
                "strategy_id": "demo",
                "total_pnl": result.get("result", {}).get("total_pnl", 0),
            }
        )
        return result
    finally:
        _backtest_lock = False


class ParameterSweepRequest(BaseModel):
    fast_period_min: int = Field(5, ge=2, le=100)
    fast_period_max: int = Field(20, ge=2, le=100)
    fast_period_step: int = Field(5, ge=1, le=50)
    slow_period_min: int = Field(15, ge=3, le=500)
    slow_period_max: int = Field(50, ge=3, le=500)
    slow_period_step: int = Field(10, ge=1, le=100)
    starting_balance: float = Field(100_000.0, gt=0)
    num_bars: int = Field(500, ge=10, le=5000)

    @field_validator("fast_period_max")
    @classmethod
    def check_fast_range(cls, v: int, info) -> int:
        if v < info.data.get("fast_period_min", v):
            raise ValueError("fast_period_max must be >= fast_period_min")
        return v

    @field_validator("slow_period_max")
    @classmethod
    def check_slow_range(cls, v: int, info) -> int:
        if v < info.data.get("slow_period_min", v):
            raise ValueError("slow_period_max must be >= slow_period_min")
        return v


@router.post("/parameter-sweep")
async def run_parameter_sweep(request: ParameterSweepRequest, _user: dict = Depends(get_current_user)):
    """
    Run a grid search over SMA fast/slow period combinations.
    Returns ranked results sorted by total P&L descending.
    Max 25 combinations to keep response time reasonable.
    """
    global _backtest_lock
    if _backtest_lock:
        raise HTTPException(status_code=409, detail="A backtest is already running. Please wait.")

    fast_range = list(range(
        request.fast_period_min,
        request.fast_period_max + 1,
        request.fast_period_step,
    ))
    slow_range = list(range(
        request.slow_period_min,
        request.slow_period_max + 1,
        request.slow_period_step,
    ))

    # Build all valid (fast, slow) pairs where slow > fast
    combos = [
        (f, s)
        for f in fast_range
        for s in slow_range
        if s > f
    ]

    # Cap at 25 combinations to prevent timeout
    MAX_COMBOS = 25
    if len(combos) > MAX_COMBOS:
        # Sample evenly from the list
        step = len(combos) // MAX_COMBOS
        combos = combos[::step][:MAX_COMBOS]

    if not combos:
        raise HTTPException(
            status_code=400,
            detail="No valid combinations: slow_period must be > fast_period for all pairs.",
        )

    _backtest_lock = True
    results = []
    try:
        for fast, slow in combos:
            try:
                r = nautilus_system.run_demo_backtest(
                    fast_period=fast,
                    slow_period=slow,
                    starting_balance=request.starting_balance,
                    num_bars=request.num_bars,
                )
                if r.get("success"):
                    res = r.get("result", {})
                    results.append({
                        "fast_period": fast,
                        "slow_period": slow,
                        "total_pnl": round(res.get("total_pnl", 0.0), 2),
                        "win_rate": round(res.get("win_rate", 0.0), 2),
                        "total_trades": res.get("total_trades", 0),
                        "ending_balance": round(res.get("ending_balance", request.starting_balance), 2),
                        "max_drawdown": round(res.get("max_drawdown", 0.0), 2),
                        "sharpe_ratio": round(res.get("sharpe_ratio", 0.0), 4) if res.get("sharpe_ratio") is not None else None,
                    })
            except Exception:
                # Skip failed individual runs, continue sweep
                continue
    finally:
        _backtest_lock = False

    # Sort by total_pnl descending
    results.sort(key=lambda x: x["total_pnl"], reverse=True)

    return {
        "success": True,
        "combinations_tested": len(results),
        "combinations_requested": len(combos),
        "starting_balance": request.starting_balance,
        "num_bars": request.num_bars,
        "results": results,
        "best": results[0] if results else None,
    }


@router.get("/system-info")
async def get_system_info():
    return nautilus_system.get_system_info()


class DataDownloadRequest(BaseModel):
    symbol: str = Field("BTCUSDT", min_length=3, max_length=20)
    interval: str = Field("1m", pattern="^(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|1w)$")
    start_date: str = "2024-01-01"
    end_date: str = "2024-01-31"

    @field_validator("start_date", "end_date")
    @classmethod
    def check_date(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Date must be YYYY-MM-DD")
        return v


@router.post("/download-data")
async def download_data(
    request: DataDownloadRequest, _user: dict = Depends(get_current_user)
):
    """
    Download historical OHLCV data from Binance and store in the
    NautilusTrader ParquetDataCatalog for use in backtesting.
    """
    catalog_path = nautilus_system.catalog_path
    success, msg, count = await data_loader.download_and_cache(
        symbol=request.symbol,
        interval=request.interval,
        start_date=request.start_date,
        end_date=request.end_date,
        catalog_path=catalog_path,
    )
    if not success:
        raise HTTPException(status_code=502, detail=msg)

    # Re-initialize catalog so new instruments are visible
    nautilus_system.initialize()

    return {
        "success": True,
        "symbol": request.symbol,
        "interval": request.interval,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "bars_downloaded": count,
        "message": msg,
    }


@router.post("/initialize")
async def initialize_system(_user: dict = Depends(get_current_user)):
    result = nautilus_system.initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result
