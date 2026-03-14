"""
Nautilus Trader API
FastAPI backend for Nautilus Trader Web Interface with real Nautilus integration
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import asyncio
from datetime import datetime

# Import Nautilus integration
from nautilus_integration import nautilus_manager
from nautilus_core import NautilusTradingSystem
from auth import ApiKeyMiddleware

import sys
from pathlib import Path
_backend_dir = Path(__file__).parent
sys.path.insert(0, str(_backend_dir))
os.environ.setdefault('NAUTILUS_CATALOG_PATH', str(_backend_dir.parent / 'nautilus_data' / 'catalog'))

_nautilus_system = NautilusTradingSystem(
    catalog_path=os.environ['NAUTILUS_CATALOG_PATH']
)

app = FastAPI(
    title="Nautilus Trader API",
    description="Backend API for Nautilus Trader Web Interface",
    version="2.0.0"
)

# CORS configuration - set CORS_ORIGINS env var in production
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key authentication (enabled when API_KEY env var is set)
app.add_middleware(ApiKeyMiddleware)

# Pydantic models
class StrategyConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    description: Optional[str] = ""
    config: Dict[str, Any] = {}

class OrderRequest(BaseModel):
    instrument: str = "BTCUSDT"
    side: str = "BUY"
    type: str = "LIMIT"
    quantity: float
    price: Optional[float] = None

class RiskLimitsRequest(BaseModel):
    max_order_size: Optional[float] = None
    max_position_size: Optional[float] = None
    max_daily_loss: Optional[float] = None
    max_positions: Optional[int] = None

class DemoBacktestRequest(BaseModel):
    fast_period: int = 10
    slow_period: int = 20
    starting_balance: float = 100000.0
    num_bars: int = 500

class BacktestRequest(BaseModel):
    strategy_id: str
    start_date: str = "2020-01-01"
    end_date: str = "2020-01-31"
    starting_balance: float = 100000.0

# ---------- Health ----------

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0"
    }

# ---------- Engine ----------

@app.post("/api/engine/initialize")
async def initialize_engine():
    result = nautilus_manager.initialize_backtest_engine()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@app.get("/api/engine/info")
async def get_engine_info():
    return nautilus_manager.get_engine_info()

@app.post("/api/engine/shutdown")
async def shutdown_engine():
    result = nautilus_manager.shutdown()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

# ---------- Components ----------

@app.get("/api/components")
async def get_components():
    return {"components": nautilus_manager.get_components()}

@app.get("/api/components/{component_id}")
async def get_component(component_id: str):
    components = nautilus_manager.get_components()
    component = next((c for c in components if c["id"] == component_id), None)
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component

# ---------- Adapters ----------

@app.get("/api/adapters")
async def get_adapters():
    return {"adapters": nautilus_manager.get_adapters()}

@app.get("/api/adapters/{adapter_id}")
async def get_adapter(adapter_id: str):
    adapters = nautilus_manager.get_adapters()
    adapter = next((a for a in adapters if a["id"] == adapter_id), None)
    if not adapter:
        raise HTTPException(status_code=404, detail="Adapter not found")
    return adapter

@app.post("/api/adapters/{adapter_id}/connect")
async def connect_adapter(adapter_id: str):
    result = nautilus_manager.connect_adapter(adapter_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/adapters/{adapter_id}/disconnect")
async def disconnect_adapter(adapter_id: str):
    result = nautilus_manager.disconnect_adapter(adapter_id)
    return result

# ---------- Strategies ----------

@app.get("/api/strategies")
async def get_strategies():
    return {"strategies": nautilus_manager.get_strategies()}

@app.post("/api/strategies")
async def create_strategy(strategy: StrategyConfig):
    result = nautilus_manager.add_strategy(strategy.dict())
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    strategies = nautilus_manager.get_strategies()
    strategy = next((s for s in strategies if s["id"] == strategy_id), None)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy

@app.post("/api/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    result = nautilus_manager.start_strategy(strategy_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    result = nautilus_manager.stop_strategy(strategy_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.delete("/api/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    result = nautilus_manager.delete_strategy(strategy_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result

# ---------- Orders ----------

@app.get("/api/orders")
async def get_orders(status: Optional[str] = None):
    return {"orders": nautilus_manager.get_orders(status=status)}

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    order = nautilus_manager.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/orders")
async def create_order(order_data: OrderRequest):
    result = nautilus_manager.create_order(order_data.dict())
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.delete("/api/orders/{order_id}")
async def cancel_order(order_id: str):
    result = nautilus_manager.cancel_order(order_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

# ---------- Positions ----------

@app.get("/api/positions")
async def get_positions():
    return {"positions": nautilus_manager.get_positions()}

@app.get("/api/positions/{position_id}")
async def get_position(position_id: str):
    pos = nautilus_manager.get_position(position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return pos

@app.post("/api/positions/{position_id}/close")
async def close_position(position_id: str):
    result = nautilus_manager.close_position(position_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

# ---------- Trades ----------

@app.get("/api/trades")
async def get_trades(limit: int = 100):
    return {"trades": nautilus_manager.get_trades(limit=limit)}

# ---------- Account ----------

@app.get("/api/account")
async def get_account():
    return nautilus_manager.get_account_info()

# ---------- Risk ----------

@app.get("/api/risk/metrics")
async def get_risk_metrics():
    return nautilus_manager.get_risk_metrics()

@app.get("/api/risk/limits")
async def get_risk_limits():
    return nautilus_manager.get_risk_limits()

@app.post("/api/risk/limits")
async def update_risk_limits(limits: RiskLimitsRequest):
    data = {k: v for k, v in limits.dict().items() if v is not None}
    return nautilus_manager.update_risk_limits(data)

# ---------- Market Data (simulated) ----------

@app.get("/api/market-data/instruments")
async def get_market_instruments():
    """Get list of supported instruments"""
    instruments = [
        {"symbol": "BTCUSDT", "base": "BTC", "quote": "USDT", "exchange": "BINANCE", "price": 65420.0, "change_24h": 2.3},
        {"symbol": "ETHUSDT", "base": "ETH", "quote": "USDT", "exchange": "BINANCE", "price": 3240.0, "change_24h": -0.8},
        {"symbol": "BNBUSDT", "base": "BNB", "quote": "USDT", "exchange": "BINANCE", "price": 580.0, "change_24h": 1.1},
        {"symbol": "SOLUSDT", "base": "SOL", "quote": "USDT", "exchange": "BINANCE", "price": 175.0, "change_24h": 4.2},
        {"symbol": "ADAUSDT", "base": "ADA", "quote": "USDT", "exchange": "BINANCE", "price": 0.485, "change_24h": -1.5},
        {"symbol": "DOTUSDT", "base": "DOT", "quote": "USDT", "exchange": "BINANCE", "price": 8.2, "change_24h": 0.7},
    ]
    return {"instruments": instruments}

@app.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str):
    """Get market data for a symbol"""
    import random
    base_prices = {"BTCUSDT": 65420.0, "ETHUSDT": 3240.0, "BNBUSDT": 580.0}
    price = base_prices.get(symbol.upper(), 100.0)

    return {
        "symbol": symbol.upper(),
        "price": price * (1 + random.uniform(-0.001, 0.001)),
        "bid": price * 0.9998,
        "ask": price * 1.0002,
        "volume_24h": random.uniform(1000000, 50000000),
        "change_24h": random.uniform(-5, 5),
        "timestamp": datetime.utcnow().isoformat(),
    }

# ---------- Backtesting (Nautilus) ----------

@app.post("/api/nautilus/demo-backtest")
async def run_demo_backtest(request: DemoBacktestRequest):
    """Run a demo backtest using synthetic EUR/USD data via NautilusTrader BacktestEngine"""
    result = _nautilus_system.run_demo_backtest(
        fast_period=request.fast_period,
        slow_period=request.slow_period,
        starting_balance=request.starting_balance,
        num_bars=request.num_bars,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Demo backtest failed"))
    return result


@app.post("/api/nautilus/backtest")
async def run_backtest(request: BacktestRequest):
    """Run a backtest for a registered strategy"""
    result = _nautilus_system.run_backtest(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        starting_balance=request.starting_balance,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Backtest failed"))
    return result


# ---------- Performance ----------

@app.get("/api/performance/summary")
async def get_performance_summary():
    """Get performance summary"""
    trades = nautilus_manager.get_trades(limit=1000)
    positions = list(nautilus_manager.positions.values())

    total_realized = sum(p.get("realized_pnl", 0) for p in positions)
    total_unrealized = sum(p.get("unrealized_pnl", 0) for p in nautilus_manager.get_positions())
    total_trades = len(trades)
    winning = sum(1 for t in trades if t.get("realized_pnl", 0) > 0)
    losing = sum(1 for t in trades if t.get("realized_pnl", 0) < 0)
    win_rate = (winning / total_trades * 100) if total_trades > 0 else 0.0

    return {
        "total_pnl": round(total_realized + total_unrealized, 2),
        "realized_pnl": round(total_realized, 2),
        "unrealized_pnl": round(total_unrealized, 2),
        "total_trades": total_trades,
        "winning_trades": winning,
        "losing_trades": losing,
        "win_rate": round(win_rate, 1),
        "total_positions": len(positions),
        "open_positions": len(nautilus_manager.get_positions()),
    }

# ---------- Alerts ----------

_alerts: List[Dict[str, Any]] = []

class AlertRequest(BaseModel):
    symbol: str
    condition: str  # above, below
    price: float
    message: Optional[str] = None

@app.get("/api/alerts")
async def get_alerts():
    return {"alerts": _alerts}

@app.post("/api/alerts")
async def create_alert(alert: AlertRequest):
    alert_id = f"ALERT-{len(_alerts) + 1:04d}"
    new_alert = {
        "id": alert_id,
        "symbol": alert.symbol,
        "condition": alert.condition,
        "price": alert.price,
        "message": alert.message or f"{alert.symbol} {alert.condition} {alert.price}",
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
        "triggered_at": None,
    }
    _alerts.append(new_alert)
    return {"success": True, "alert": new_alert}

@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    global _alerts
    before = len(_alerts)
    _alerts = [a for a in _alerts if a["id"] != alert_id]
    if len(_alerts) == before:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "message": f"Alert {alert_id} deleted"}

# ---------- WebSocket ----------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(2)

            engine_info = nautilus_manager.get_engine_info()
            strategies = nautilus_manager.get_strategies()
            positions = nautilus_manager.get_positions()
            risk = nautilus_manager.get_risk_metrics()

            await websocket.send_json({
                "type": "update",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "engine": engine_info,
                    "strategies_count": len(strategies),
                    "positions_count": len(positions),
                    "risk": risk,
                }
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NAUTILUS_API_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
