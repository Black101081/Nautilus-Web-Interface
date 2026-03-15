from typing import Any, Dict

from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter(prefix="/api/component", tags=["components"])


class ComponentActionRequest(BaseModel):
    component: str = ""


@router.post("/stop")
async def stop_component(req: ComponentActionRequest):
    return {"success": True, "message": f"Component '{req.component}' stopped"}


@router.post("/start")
async def start_component(req: ComponentActionRequest):
    return {"success": True, "message": f"Component '{req.component}' started"}


@router.post("/restart")
async def restart_component(req: ComponentActionRequest):
    return {"success": True, "message": f"Component '{req.component}' restarted"}


@router.post("/configure")
async def configure_component(req: ComponentActionRequest):
    return {"success": True, "message": f"Component '{req.component}' configured"}
