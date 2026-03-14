"""
FastAPI Backend for Nautilus Trader Web Interface
Exposes real Nautilus Trader functionality via REST API
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import sys
import asyncio
import json
from datetime import datetime
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


class DemoBacktestRequest(BaseModel):
    fast_period: int = 10
    slow_period: int = 20
    starting_balance: float = 100000.0
    num_bars: int = 500


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


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
    total_pnl = 0.0
    total_trades = 0
    max_drawdown = 0.0
    sharpe_ratio = 0.0

    for strategy_id, results in nautilus_system.backtest_results.items():
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


# ─── Additional endpoints required by frontend ───────────────────────────────

@app.get("/api/engine/info")
async def get_engine_info():
    """Engine status for AdminDashboard"""
    info = nautilus_system.get_system_info()
    return {
        "trader_id": info["trader_id"],
        "status": "running" if info["is_initialized"] else "initializing",
        "engine_type": "BacktestEngine",
        "is_running": info["is_initialized"],
        "strategies_count": info["strategies_count"],
        "backtests_count": info.get("backtests_count", len(nautilus_system.backtest_results)),
        "is_initialized": info["is_initialized"],
        "catalog_path": info["catalog_path"],
        "uptime": "active",
    }


@app.get("/api/instruments")
async def list_instruments():
    """List available instruments"""
    instruments = []
    for instr in nautilus_system.instruments:
        instruments.append({
            "id": str(instr.id),
            "symbol": str(instr.id.symbol),
            "venue": str(instr.id.venue),
        })
    # Fallback demo instruments when catalog is not loaded
    if not instruments:
        instruments = [
            {"id": "EUR/USD.SIM", "symbol": "EUR/USD", "venue": "SIM"},
            {"id": "GBP/USD.SIM", "symbol": "GBP/USD", "venue": "SIM"},
            {"id": "USD/JPY.SIM", "symbol": "USD/JPY", "venue": "SIM"},
            {"id": "AUD/USD.SIM", "symbol": "AUD/USD", "venue": "SIM"},
            {"id": "BTCUSDT.BINANCE", "symbol": "BTCUSDT", "venue": "BINANCE"},
            {"id": "ETHUSDT.BINANCE", "symbol": "ETHUSDT", "venue": "BINANCE"},
        ]
    return {"instruments": instruments, "count": len(instruments)}


@app.get("/api/adapters")
async def list_adapters():
    """List all available NautilusTrader adapters"""
    adapters = [
        {
            "id": "betfair",
            "name": "Betfair",
            "type": "Betting Exchange",
            "category": "Betting",
            "status": "available",
            "description": "Sports betting exchange adapter for Betfair markets",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/betfair",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "binance",
            "name": "Binance",
            "type": "Crypto Exchange",
            "category": "Crypto",
            "status": "available",
            "description": "World's largest crypto exchange – spot and margin trading",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "binance_futures",
            "name": "Binance Futures",
            "type": "Crypto Futures",
            "category": "Crypto",
            "status": "available",
            "description": "Binance USD-M and COIN-M perpetual & dated futures",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "bybit",
            "name": "Bybit",
            "type": "Crypto Exchange",
            "category": "Crypto",
            "status": "available",
            "description": "Bybit spot, perpetuals, and options trading",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/bybit",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "coinbase_advanced_trade",
            "name": "Coinbase Advanced Trade",
            "type": "Crypto Exchange",
            "category": "Crypto",
            "status": "available",
            "description": "Coinbase Advanced Trade API for professional trading",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/coinbase",
            "supports_live": True,
            "supports_backtest": False,
        },
        {
            "id": "databento",
            "name": "Databento",
            "type": "Data Provider",
            "category": "Data",
            "status": "available",
            "description": "Historical and live institutional-grade market data",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/databento",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "dydx",
            "name": "dYdX",
            "type": "DeFi Exchange",
            "category": "DeFi",
            "status": "available",
            "description": "Decentralized perpetuals exchange on Ethereum L2",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/dydx",
            "supports_live": True,
            "supports_backtest": False,
        },
        {
            "id": "interactive_brokers",
            "name": "Interactive Brokers",
            "type": "Traditional Broker",
            "category": "Stocks & Futures",
            "status": "available",
            "description": "Multi-asset brokerage – stocks, futures, forex, options",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/ib",
            "supports_live": True,
            "supports_backtest": False,
        },
        {
            "id": "okx",
            "name": "OKX",
            "type": "Crypto Exchange",
            "category": "Crypto",
            "status": "available",
            "description": "OKX spot, futures, options and DeFi trading",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/okx",
            "supports_live": True,
            "supports_backtest": True,
        },
        {
            "id": "polymarket",
            "name": "Polymarket",
            "type": "Prediction Market",
            "category": "DeFi",
            "status": "available",
            "description": "On-chain decentralized prediction markets",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/polymarket",
            "supports_live": True,
            "supports_backtest": False,
        },
        {
            "id": "tardis",
            "name": "Tardis",
            "type": "Data Provider",
            "category": "Data",
            "status": "available",
            "description": "Tick-level historical crypto market data replay",
            "docs_url": "https://nautilustrader.io/docs/nightly/integrations/tardis",
            "supports_live": False,
            "supports_backtest": True,
        },
    ]
    return {"adapters": adapters, "count": len(adapters)}


@app.get("/api/performance/summary")
async def get_performance_summary():
    """Aggregate performance summary across all backtests"""
    total_pnl = 0.0
    realized_pnl = 0.0
    total_trades = 0
    winning_trades = 0
    losing_trades = 0
    all_positions = 0
    open_positions = 0

    for results in nautilus_system.backtest_results.values():
        total_pnl += results.get("total_pnl", 0.0)
        realized_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
        winning_trades += results.get("winning_trades", 0)
        losing_trades += results.get("losing_trades", 0)
        all_positions += len(results.get("positions", []))
        open_positions += len([p for p in results.get("positions", []) if p.get("is_open", False)])

    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

    return {
        "total_pnl": round(total_pnl, 2),
        "realized_pnl": round(realized_pnl, 2),
        "unrealized_pnl": 0.0,
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": round(win_rate, 2),
        "total_positions": all_positions,
        "open_positions": open_positions,
    }


@app.get("/api/trades")
async def list_trades(limit: int = 20):
    """List trades from all backtests"""
    all_trades = []
    for results in nautilus_system.backtest_results.values():
        for order in results.get("orders", []):
            side_raw = str(order.get("side", ""))
            side = "BUY" if "BUY" in side_raw else "SELL" if "SELL" in side_raw else side_raw
            status_raw = str(order.get("status", ""))
            status = "FILLED" if "FILLED" in status_raw else status_raw
            all_trades.append({
                "id": order.get("id", ""),
                "instrument": order.get("instrument_id", ""),
                "side": side,
                "quantity": order.get("quantity", 0),
                "price": order.get("avg_px"),
                "status": status,
                "filled_qty": order.get("filled_qty", 0),
                "timestamp": datetime.utcnow().isoformat(),
            })
    return {"trades": all_trades[:limit], "count": len(all_trades)}


@app.post("/api/nautilus/demo-backtest")
async def run_demo_backtest(request: DemoBacktestRequest):
    """Run a demo backtest using synthetic data – no real data catalog required"""
    result = nautilus_system.run_demo_backtest(
        fast_period=request.fast_period,
        slow_period=request.slow_period,
        starting_balance=request.starting_balance,
        num_bars=request.num_bars,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("message", "Demo backtest failed"))
    # Broadcast event to WebSocket clients
    await manager.broadcast({
        "type": "backtest_complete",
        "strategy_id": "demo",
        "total_pnl": result["result"].get("total_pnl", 0),
    })
    return result


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time engine events"""
    await manager.connect(websocket)
    try:
        # Send initial status on connect
        info = nautilus_system.get_system_info()
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "trader_id": info["trader_id"],
            "is_initialized": info["is_initialized"],
        })
        # Keep alive – echo any pings from client
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


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

