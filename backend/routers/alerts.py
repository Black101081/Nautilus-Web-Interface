"""
Alerts Router
=============
Handles /api/alerts/* endpoints with SQLite persistence via alerts_db.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import alerts_db

router = APIRouter()


class AlertRequest(BaseModel):
    symbol: str
    condition: str  # above / below
    price: float
    message: Optional[str] = None


@router.get("/api/alerts")
async def get_alerts():
    return {"alerts": await alerts_db.get_all_alerts()}


@router.post("/api/alerts")
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


@router.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    deleted = await alerts_db.delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "message": f"Alert {alert_id} deleted"}
