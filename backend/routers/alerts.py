from typing import Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

import database

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertCreateRequest(BaseModel):
    symbol: str = Field("BTCUSDT", min_length=1, max_length=20)
    condition: str = Field("above", pattern="^(above|below)$")
    price: float = Field(..., gt=0)
    message: Optional[str] = Field("", max_length=200)


@router.get("")
async def list_alerts():
    alerts = await database.list_alerts()
    return {"alerts": alerts, "count": len(alerts)}


@router.post("")
async def create_alert(req: AlertCreateRequest):
    alert = await database.create_alert(
        symbol=req.symbol,
        condition=req.condition,
        price=req.price,
        message=req.message or "",
    )
    return {"success": True, "alert": alert}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    deleted = await database.delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return {"success": True}
