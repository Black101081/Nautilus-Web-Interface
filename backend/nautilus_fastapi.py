"""
FastAPI Backend for Nautilus Trader Web Interface
Exposes real Nautilus Trader functionality via REST API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import Nautilus core with correct catalog path
import os
os.environ['NAUTILUS_CATALOG_PATH'] = str(backend_dir.parent / 'nautilus_data' / 'catalog')

from nautilus_core import NautilusTradingSystem

# Initialize with correct catalog path
nautilus_system = NautilusTradingSystem(
    catalog_path=str(backend_dir.parent / 'nautilus_data' / 'catalog')
)

app = FastAPI(
    title="Nautilus Trader API",
    description="Real Nautilus Trader integration API - NOT MOCK",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class StrategyCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str
    type: str = "sma_crossover"
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    fast_period: int = 10
    slow_period: int = 20
    trade_size: str = "100000"


class BacktestRequest(BaseModel):
    strategy_id: str
    start_date: str = "2020-01-01"
    end_date: str = "2020-01-31"
    starting_balance: float = 100000.0


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Nautilus Trader API",
        "version": "2.0.0",
        "status": "running",
        "message": "Real Nautilus Trader integration - NOT MOCK"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    system_info = nautilus_system.get_system_info()
    return {
        "status": "healthy",
        "system": system_info
    }


@app.post("/api/nautilus/initialize")
async def initialize_system():
    """Initialize Nautilus Trading System"""
    result = nautilus_system.initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@app.get("/api/nautilus/system-info")
async def get_system_info():
    """Get system information"""
    return nautilus_system.get_system_info()


@app.post("/api/nautilus/strategies")
async def create_strategy(request: StrategyCreateRequest):
    """Create a new trading strategy"""
    config = request.dict()
    result = nautilus_system.create_strategy(config)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/nautilus/strategies")
async def list_strategies():
    """List all strategies"""
    strategies = nautilus_system.get_all_strategies()
    return {
        "success": True,
        "strategies": strategies,
        "count": len(strategies)
    }


@app.get("/api/nautilus/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    """Get a specific strategy"""
    strategy = nautilus_system.get_strategy(strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")
    return {
        "success": True,
        "strategy": strategy
    }


@app.post("/api/nautilus/backtest")
async def run_backtest(request: BacktestRequest):
    """Run a backtest"""
    result = nautilus_system.run_backtest(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        starting_balance=request.starting_balance
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@app.get("/api/nautilus/backtest/{strategy_id}")
async def get_backtest_results(strategy_id: str):
    """Get backtest results for a strategy"""
    results = nautilus_system.get_backtest_results(strategy_id)
    if not results:
        raise HTTPException(
            status_code=404, 
            detail=f"No backtest results found for strategy {strategy_id}"
        )
    return {
        "success": True,
        "results": results
    }


# Legacy endpoints for compatibility with existing frontend

@app.get("/api/strategies")
async def legacy_list_strategies():
    """Legacy endpoint for listing strategies"""
    strategies = nautilus_system.get_all_strategies()
    
    # Transform to legacy format
    legacy_strategies = []
    for strategy in strategies:
        # Get backtest results if available
        backtest_results = nautilus_system.get_backtest_results(strategy["id"])
        
        legacy_strategies.append({
            "id": strategy["id"],
            "name": strategy["name"],
            "type": strategy["type"],
            "status": strategy["status"],
            "instrument": strategy["config"].instrument_id if hasattr(strategy.get("config"), "instrument_id") else "EUR/USD.SIM",
            "pnl": backtest_results.get("total_pnl", 0.0) if backtest_results else 0.0,
            "trades": backtest_results.get("total_trades", 0) if backtest_results else 0,
            "win_rate": backtest_results.get("win_rate", 0.0) if backtest_results else 0.0
        })
    
    return legacy_strategies


@app.get("/api/orders")
async def legacy_list_orders():
    """Legacy endpoint for listing orders"""
    # Get orders from latest backtest
    all_orders = []
    for strategy_id, results in nautilus_system.backtest_results.items():
        if "orders" in results:
            all_orders.extend(results["orders"])
    
    return all_orders[:100]  # Limit to 100


@app.get("/api/positions")
async def legacy_list_positions():
    """Legacy endpoint for listing positions"""
    # Get positions from latest backtest
    all_positions = []
    for strategy_id, results in nautilus_system.backtest_results.items():
        if "positions" in results:
            all_positions.extend(results["positions"])
    
    return all_positions[:100]  # Limit to 100


@app.get("/api/risk/metrics")
async def legacy_risk_metrics():
    """Legacy endpoint for risk metrics"""
    # Calculate aggregate risk metrics from all backtests
    total_pnl = 0.0
    total_trades = 0
    total_exposure = 0.0
    
    for strategy_id, results in nautilus_system.backtest_results.items():
        total_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
    
    return {
        "total_exposure": total_exposure,
        "var_95": 0.0,  # To be calculated
        "max_drawdown": 0.0,  # To be calculated
        "sharpe_ratio": 0.0,  # To be calculated
        "total_pnl": total_pnl,
        "total_trades": total_trades
    }


if __name__ == "__main__":
    import uvicorn
    
    print("=" * 80)
    print("🚀 Starting Nautilus Trader API Server")
    print("=" * 80)
    print("📡 Server: http://0.0.0.0:8000")
    print("📚 Docs: http://0.0.0.0:8000/docs")
    print(f"📊 Data Catalog: {os.environ.get('NAUTILUS_CATALOG_PATH')}")
    print("=" * 80)
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

