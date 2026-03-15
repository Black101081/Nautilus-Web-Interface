import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

import database
from state import nautilus_system, manager

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
async def run_backtest(request: BacktestRequest):
    global _backtest_lock
    if _backtest_lock:
        raise HTTPException(status_code=409, detail="A backtest is already running. Please wait.")
    _backtest_lock = True
    try:
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
async def run_demo_backtest(request: DemoBacktestRequest):
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
                "total_pnl": result["result"].get("total_pnl", 0),
            }
        )
        return result
    finally:
        _backtest_lock = False


@router.get("/system-info")
async def get_system_info():
    return nautilus_system.get_system_info()


@router.post("/initialize")
async def initialize_system():
    result = nautilus_system.initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result
