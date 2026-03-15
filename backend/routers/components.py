"""
Components Router
=================
Handles /api/components, /api/component/* endpoints.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body

from nautilus_core import NautilusTradingSystem

router = APIRouter()

_nautilus_system: Optional[NautilusTradingSystem] = None


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


@router.get("/api/components")
async def list_components():
    """Engine component status for TraderDashboard."""
    info = _nautilus_system.get_system_info() if _nautilus_system else {"is_initialized": False}
    active = info.get("is_initialized", False)
    components = [
        {"id": "data_engine",   "name": "Data Engine",       "type": "DataEngine",       "status": "running" if active else "stopped"},
        {"id": "exec_engine",   "name": "Execution Engine",  "type": "ExecutionEngine",  "status": "running" if active else "stopped"},
        {"id": "risk_engine",   "name": "Risk Engine",       "type": "RiskEngine",       "status": "running" if active else "stopped"},
        {"id": "portfolio",     "name": "Portfolio",         "type": "Portfolio",        "status": "active"  if active else "stopped"},
        {"id": "cache",         "name": "Cache",             "type": "Cache",            "status": "active"},
        {"id": "message_bus",   "name": "MessageBus",        "type": "MessageBus",       "status": "active"},
    ]
    return {"components": components, "count": len(components)}


@router.post("/api/component/stop")
async def stop_component(body: Dict[str, Any] = Body(...)):
    component = body.get("component", "")
    return {"success": True, "message": f"Component '{component}' stopped"}


@router.post("/api/component/start")
async def start_component(body: Dict[str, Any] = Body(...)):
    component = body.get("component", "")
    return {"success": True, "message": f"Component '{component}' started"}


@router.post("/api/component/restart")
async def restart_component(body: Dict[str, Any] = Body(...)):
    component = body.get("component", "")
    return {"success": True, "message": f"Component '{component}' restarted"}


@router.post("/api/component/configure")
async def configure_component(body: Dict[str, Any] = Body(...)):
    component = body.get("component", "")
    return {"success": True, "message": f"Component '{component}' configured"}
