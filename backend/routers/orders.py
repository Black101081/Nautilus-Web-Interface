"""
Orders Router
=============
Handles /api/orders/* endpoints with SQLite persistence.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException

import database
from nautilus_core import NautilusTradingSystem

router = APIRouter()

_nautilus_system: Optional[NautilusTradingSystem] = None


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


def _get_system() -> NautilusTradingSystem:
    if _nautilus_system is None:
        raise HTTPException(status_code=503, detail="Trading system not initialized")
    return _nautilus_system


@router.get("/api/orders")
async def list_orders():
    """List orders – backtest orders merged with persisted pending orders."""
    system = _get_system()
    all_orders: List[Dict[str, Any]] = []

    # Orders from backtests
    for results in system.backtest_results.values():
        for o in results.get("orders", []):
            side_raw = str(o.get("side", ""))
            side = "BUY" if "BUY" in side_raw else "SELL" if "SELL" in side_raw else side_raw
            status_raw = str(o.get("status", ""))
            status = "FILLED" if "FILLED" in status_raw else status_raw
            all_orders.append({
                "id": o.get("id", ""),
                "instrument": o.get("instrument_id", ""),
                "side": side,
                "type": "MARKET",
                "quantity": o.get("quantity", 0),
                "price": o.get("avg_px"),
                "status": status,
                "filled_qty": o.get("filled_qty", 0),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    # Persisted manual orders
    persisted = await database.get_all_orders()
    all_orders.extend(persisted)
    return {"orders": all_orders[:100], "count": len(all_orders)}


@router.post("/api/orders")
async def create_order(order_body: Dict[str, Any] = Body(...)):
    """Create a manual order (persisted to SQLite)."""
    order = {
        "id": f"ORD-{uuid.uuid4().hex[:8].upper()}",
        "instrument": order_body.get("instrument", "EUR/USD.SIM"),
        "side": order_body.get("side", "BUY"),
        "type": order_body.get("type", "MARKET"),
        "quantity": order_body.get("quantity", 0),
        "price": order_body.get("price"),
        "status": "PENDING",
        "filled_qty": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = await database.create_order(order)
    return {"success": True, "order": saved}


@router.delete("/api/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel a pending order."""
    updated = await database.update_order_status(order_id, "CANCELLED")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    return {"success": True, "message": f"Order {order_id} cancelled"}
