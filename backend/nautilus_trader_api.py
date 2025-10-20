"""
Nautilus Trader API
FastAPI backend for Nautilus Trader Web Interface with real Nautilus integration
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from datetime import datetime

# Import Nautilus integration
from nautilus_integration import nautilus_manager

app = FastAPI(
    title="Nautilus Trader API",
    description="Backend API for Nautilus Trader Web Interface",
    version="2.0.0"
)

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://nautilus-web-interface.pages.dev").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class StrategyConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    description: Optional[str] = ""
    config: Dict[str, Any] = {}

class StrategyAction(BaseModel):
    action: str  # start, stop, restart

# Health check
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0"
    }

# Engine endpoints
@app.post("/api/engine/initialize")
async def initialize_engine():
    """Initialize Nautilus Trader engine"""
    result = nautilus_manager.initialize_backtest_engine()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@app.get("/api/engine/info")
async def get_engine_info():
    """Get engine information"""
    return nautilus_manager.get_engine_info()

@app.post("/api/engine/shutdown")
async def shutdown_engine():
    """Shutdown the engine"""
    result = nautilus_manager.shutdown()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result

# Components endpoints
@app.get("/api/components")
async def get_components():
    """Get all Nautilus components"""
    components = nautilus_manager.get_components()
    return {"components": components}

@app.get("/api/components/{component_id}")
async def get_component(component_id: str):
    """Get specific component details"""
    components = nautilus_manager.get_components()
    component = next((c for c in components if c["id"] == component_id), None)
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component

# Adapters endpoints
@app.get("/api/adapters")
async def get_adapters():
    """Get all adapters"""
    adapters = nautilus_manager.get_adapters()
    return {"adapters": adapters}

@app.get("/api/adapters/{adapter_id}")
async def get_adapter(adapter_id: str):
    """Get specific adapter details"""
    adapters = nautilus_manager.get_adapters()
    adapter = next((a for a in adapters if a["id"] == adapter_id), None)
    if not adapter:
        raise HTTPException(status_code=404, detail="Adapter not found")
    return adapter

@app.post("/api/adapters/{adapter_id}/connect")
async def connect_adapter(adapter_id: str):
    """Connect an adapter"""
    # TODO: Implement real adapter connection
    return {
        "success": True,
        "message": f"Adapter {adapter_id} connection initiated",
        "status": "connecting"
    }

@app.post("/api/adapters/{adapter_id}/disconnect")
async def disconnect_adapter(adapter_id: str):
    """Disconnect an adapter"""
    # TODO: Implement real adapter disconnection
    return {
        "success": True,
        "message": f"Adapter {adapter_id} disconnected",
        "status": "disconnected"
    }

# Strategies endpoints
@app.get("/api/strategies")
async def get_strategies():
    """Get all strategies"""
    strategies = nautilus_manager.get_strategies()
    return {"strategies": strategies}

@app.post("/api/strategies")
async def create_strategy(strategy: StrategyConfig):
    """Create a new strategy"""
    result = nautilus_manager.add_strategy(strategy.dict())
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    """Get specific strategy details"""
    strategies = nautilus_manager.get_strategies()
    strategy = next((s for s in strategies if s["id"] == strategy_id), None)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy

@app.post("/api/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    """Start a strategy"""
    result = nautilus_manager.start_strategy(strategy_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    """Stop a strategy"""
    result = nautilus_manager.stop_strategy(strategy_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.delete("/api/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    """Delete a strategy"""
    # TODO: Implement strategy deletion
    return {
        "success": True,
        "message": f"Strategy {strategy_id} deleted"
    }

# Orders endpoints
@app.get("/api/orders")
async def get_orders(status: Optional[str] = None):
    """Get orders"""
    orders = nautilus_manager.get_orders(status=status)
    return {"orders": orders}

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    """Get specific order details"""
    # TODO: Implement order retrieval
    raise HTTPException(status_code=404, detail="Order not found")

@app.post("/api/orders")
async def create_order(order_data: Dict[str, Any]):
    """Create a new order"""
    # TODO: Implement order creation
    return {
        "success": True,
        "message": "Order created",
        "order_id": "ORDER-001"
    }

@app.delete("/api/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel an order"""
    # TODO: Implement order cancellation
    return {
        "success": True,
        "message": f"Order {order_id} cancelled"
    }

# Positions endpoints
@app.get("/api/positions")
async def get_positions():
    """Get current positions"""
    positions = nautilus_manager.get_positions()
    return {"positions": positions}

@app.get("/api/positions/{position_id}")
async def get_position(position_id: str):
    """Get specific position details"""
    # TODO: Implement position retrieval
    raise HTTPException(status_code=404, detail="Position not found")

@app.post("/api/positions/{position_id}/close")
async def close_position(position_id: str):
    """Close a position"""
    # TODO: Implement position closing
    return {
        "success": True,
        "message": f"Position {position_id} closed"
    }

# Trades endpoints
@app.get("/api/trades")
async def get_trades(limit: int = 100):
    """Get trade history"""
    trades = nautilus_manager.get_trades(limit=limit)
    return {"trades": trades}

# Account endpoints
@app.get("/api/account")
async def get_account():
    """Get account information"""
    return nautilus_manager.get_account_info()

# Risk endpoints
@app.get("/api/risk/metrics")
async def get_risk_metrics():
    """Get risk metrics"""
    # TODO: Implement real risk metrics from Nautilus
    return {
        "total_exposure": 0.0,
        "margin_used": 0.0,
        "margin_available": 100000.0,
        "max_drawdown": 0.0,
        "var_1d": 0.0,
        "position_count": 0
    }

@app.get("/api/risk/limits")
async def get_risk_limits():
    """Get risk limits"""
    return {
        "max_order_size": 10000.0,
        "max_position_size": 50000.0,
        "max_daily_loss": 5000.0,
        "max_positions": 10
    }

@app.post("/api/risk/limits")
async def update_risk_limits(limits: Dict[str, float]):
    """Update risk limits"""
    return {
        "success": True,
        "message": "Risk limits updated",
        "limits": limits
    }

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send real-time updates every second
            await asyncio.sleep(1)
            
            # Get current data
            engine_info = nautilus_manager.get_engine_info()
            strategies = nautilus_manager.get_strategies()
            positions = nautilus_manager.get_positions()
            
            # Send update
            await websocket.send_json({
                "type": "update",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "engine": engine_info,
                    "strategies_count": len(strategies),
                    "positions_count": len(positions)
                }
            })
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NAUTILUS_API_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")

