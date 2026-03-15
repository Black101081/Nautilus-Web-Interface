from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

import database
from risk_engine import risk_engine, RiskCheckError
from state import live_manager, nautilus_system
from utils import normalize_order

router = APIRouter(prefix="/api", tags=["orders"])


class OrderCreateRequest(BaseModel):
    instrument: str = Field("EUR/USD.SIM", min_length=1, max_length=50)
    side: str = Field("BUY", pattern="^(BUY|SELL)$")
    type: str = Field("MARKET", pattern="^(MARKET|LIMIT|STOP)$")
    quantity: float = Field(..., gt=0)
    price: Optional[float] = Field(None, ge=0)
    leverage: float = Field(1.0, ge=1.0, le=1000.0)


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
    return {"orders": all_orders, "count": len(all_orders)}


@router.post("/orders")
async def create_order(req: OrderCreateRequest):
    order_dict = req.model_dump()

    # 1. Risk check — runs before anything else
    try:
        await risk_engine.check_order(order_dict)
    except RiskCheckError:
        raise  # Re-raise with 422

    # 2. Live routing when adapter is connected
    exchange_order_id = None
    if live_manager.is_connected():
        try:
            exchange_result = await live_manager.submit_order(order_dict)
            exchange_order_id = exchange_result.get("exchange_order_id")
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Exchange error: {str(exc)}")

    # 3. Persist order to DB (paper mode when no adapter, live mode otherwise)
    order = await database.create_order(
        instrument=req.instrument,
        side=req.side,
        order_type=req.type,
        quantity=req.quantity,
        price=req.price,
    )
    result: Dict[str, Any] = {"success": True, "order": order}
    if exchange_order_id:
        result["exchange_order_id"] = exchange_order_id
    return result


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    # If adapter is connected, also cancel on exchange
    if live_manager.is_connected():
        try:
            await live_manager.cancel_order(order_id)
        except Exception:
            pass  # Exchange cancel failure should not prevent DB cancel

    cancelled = await database.cancel_order(order_id)
    if not cancelled:
        # Still return success if connected (exchange order may not be in DB)
        if live_manager.is_connected():
            return {"success": True, "message": f"Order {order_id} cancel sent to exchange"}
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found or already closed")
    return {"success": True, "message": f"Order {order_id} cancelled"}
