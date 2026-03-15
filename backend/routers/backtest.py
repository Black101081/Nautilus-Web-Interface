from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import database
from state import nautilus_system, manager

router = APIRouter(prefix="/api/nautilus", tags=["backtest"])


class BacktestRequest(BaseModel):
    strategy_id: str
    start_date: str = "2020-01-01"
    end_date: str = "2020-01-31"
    starting_balance: float = Field(100_000.0, gt=0)


class DemoBacktestRequest(BaseModel):
    fast_period: int = Field(10, ge=1, le=500)
    slow_period: int = Field(20, ge=1, le=500)
    starting_balance: float = Field(100_000.0, gt=0)
    num_bars: int = Field(500, ge=10, le=10_000)


@router.post("/backtest")
async def run_backtest(request: BacktestRequest):
    result = nautilus_system.run_backtest(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        starting_balance=request.starting_balance,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    # Persist positions to DB
    positions = result.get("result", {}).get("positions", [])
    if positions:
        await database.save_positions(positions, strategy_id=request.strategy_id)
    return result


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
    # Persist demo positions
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


@router.get("/system-info")
async def get_system_info():
    return nautilus_system.get_system_info()


@router.post("/initialize")
async def initialize_system():
    result = nautilus_system.initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result
