"""
Nautilus Trader API — SECONDARY / REFERENCE IMPLEMENTATION
===========================================================
The canonical production entry point is nautilus_fastapi.py which includes
all endpoints required by the frontend (system metrics, settings, database
operations, component controls, etc.).

This file is kept as a reference/alternative implementation. Do NOT use it
as the primary server entrypoint — some frontend pages will 404 because
endpoints like /api/system/metrics, /api/settings, and /api/database/* are
only defined in nautilus_fastapi.py.

Production: python nautilus_fastapi.py (or uvicorn nautilus_fastapi:app)
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import asyncio
import uuid
from datetime import datetime, timezone

# Import Nautilus integration
from nautilus_integration import nautilus_manager
from nautilus_core import NautilusTradingSystem
from auth import ApiKeyMiddleware, API_KEY
import market_data_service
import alerts_db

# Lazy initialization — avoids crash at import time if NautilusTradingSystem
# has missing dependencies (nautilus_trader not installed, etc.)
_trading_system: Optional[NautilusTradingSystem] = None

def _get_trading_system() -> NautilusTradingSystem:
    global _trading_system
    if _trading_system is None:
        try:
            _trading_system = NautilusTradingSystem()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Trading system unavailable: {exc}")
    return _trading_system

app = FastAPI(
    title="Nautilus Trader API",
    description="Backend API for Nautilus Trader Web Interface",
    version="2.0.0"
)

# CORS configuration - set CORS_ORIGINS env var in production
# Default to localhost dev origins only; never fall back to ["*"]
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    or ["http://localhost:5173", "http://localhost:3000"]
)

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
    start_date: str = "2024-01-01"
    end_date: str = "2024-12-31"
    starting_balance: float = 100000.0

# ---------- Health ----------

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
    result = nautilus_manager.add_strategy(strategy.model_dump())
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
    result = nautilus_manager.create_order(order_data.model_dump())
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
    data = {k: v for k, v in limits.model_dump().items() if v is not None}
    return nautilus_manager.update_risk_limits(data)

# ---------- Market Data ----------

@app.get("/api/market-data/instruments")
async def get_market_instruments():
    """Get list of supported instruments with live Binance prices."""
    instruments = await market_data_service.get_instruments()
    return {"instruments": instruments}

@app.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str):
    """Get live market data for a symbol from Binance."""
    return await market_data_service.get_symbol_data(symbol)

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
    win_rate = round(winning / total_trades * 100, 1) if total_trades > 0 else 0.0

    return {
        "total_pnl": round(total_realized + total_unrealized, 2),
        "realized_pnl": round(total_realized, 2),
        "unrealized_pnl": round(total_unrealized, 2),
        "total_trades": total_trades,
        "winning_trades": winning,
        "losing_trades": losing,
        "win_rate": win_rate,
        "total_positions": len(positions),
        "open_positions": len(nautilus_manager.get_positions()),
    }

# ---------- Backtesting ----------

@app.post("/api/nautilus/demo-backtest")
async def run_demo_backtest(request: DemoBacktestRequest):
    result = _get_trading_system().run_demo_backtest(
        fast_period=request.fast_period,
        slow_period=request.slow_period,
        starting_balance=request.starting_balance,
        num_bars=request.num_bars,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Demo backtest failed"))
    return {"result": result}

@app.post("/api/nautilus/backtest")
async def run_backtest(request: BacktestRequest):
    result = _get_trading_system().run_backtest(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        starting_balance=request.starting_balance,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Backtest failed"))
    return {"result": result}

# ---------- Alerts ----------

class AlertRequest(BaseModel):
    symbol: str
    condition: str  # above, below
    price: float
    message: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Initialise persistent storage on server start."""
    await alerts_db.init_db()

@app.get("/api/alerts")
async def get_alerts():
    return {"alerts": await alerts_db.get_all_alerts()}

@app.post("/api/alerts")
async def create_alert(alert: AlertRequest):
    alert_id = f"ALERT-{uuid.uuid4().hex[:8].upper()}"
    new_alert = {
        "id": alert_id,
        "symbol": alert.symbol,
        "condition": alert.condition,
        "price": alert.price,
        "message": alert.message or f"{alert.symbol} {alert.condition} {alert.price}",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_at": None,
    }
    saved = await alerts_db.create_alert(new_alert)
    return {"success": True, "alert": saved}

@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    deleted = await alerts_db.delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "message": f"Alert {alert_id} deleted"}

# ---------- WebSocket ----------

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    # Authenticate when API_KEY is configured (same as HTTP middleware)
    if API_KEY and token != API_KEY:
        await websocket.close(code=4001, reason="Unauthorized")
        return

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
                "timestamp": datetime.now(timezone.utc).isoformat(),
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
