from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

import database
from state import nautilus_system
from utils import normalize_order

router = APIRouter(prefix="/api", tags=["orders"])


class OrderCreateRequest(BaseModel):
    instrument: str = Field("EUR/USD.SIM", min_length=1, max_length=50)
    side: str = Field("BUY", pattern="^(BUY|SELL)$")
    type: str = Field("MARKET", pattern="^(MARKET|LIMIT|STOP)$")
    quantity: float = Field(0.0, ge=0)
    price: Optional[float] = Field(None, ge=0)


@router.get("/orders")
async def list_orders():
    """List orders: backtest orders + persistent user-created orders."""
    all_orders: List[Dict[str, Any]] = []

    for results in nautilus_system.backtest_results.values():
        for o in results.get("orders", []):
            row = normalize_order(o)
            row["timestamp"] = datetime.now(timezone.utc).isoformat()
            all_orders.append(row)

    db_orders = await database.list_orders()
    all_orders.extend(db_orders)
    return {"orders": all_orders[:100], "count": len(all_orders)}


@router.post("/orders")
async def create_order(req: OrderCreateRequest):
    order = await database.create_order(
        instrument=req.instrument,
        side=req.side,
        order_type=req.type,
        quantity=req.quantity,
        price=req.price,
    )
    return {"success": True, "order": order}


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    cancelled = await database.cancel_order(order_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found or already closed")
    return {"success": True, "message": f"Order {order_id} cancelled"}
