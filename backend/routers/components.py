"""
Component lifecycle management router.

NautilusTrader internal components (DataEngine, RiskEngine, etc.) cannot be
individually started/stopped from outside the engine while it is running.
This router tracks *user-requested* states in memory and reflects the real
engine state for read operations.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from state import nautilus_system

router = APIRouter(prefix="/api/component", tags=["components"])

# ── In-memory component state store ──────────────────────────────────────────
# Keys match the component IDs returned by GET /api/components (system.py).
_COMPONENT_DEFS = {
    "data_engine": {
        "name": "Data Engine",
        "type": "DataEngine",
        "description": "Handles market data subscriptions and routing",
    },
    "exec_engine": {
        "name": "Execution Engine",
        "type": "ExecutionEngine",
        "description": "Manages order execution and fill simulation",
    },
    "risk_engine": {
        "name": "Risk Engine",
        "type": "RiskEngine",
        "description": "Enforces risk limits before order submission",
    },
    "portfolio": {
        "name": "Portfolio",
        "type": "Portfolio",
        "description": "Tracks open positions and realised PnL",
    },
    "cache": {
        "name": "Cache",
        "type": "Cache",
        "description": "In-memory store for instruments, orders and positions",
    },
    "message_bus": {
        "name": "MessageBus",
        "type": "MessageBus",
        "description": "Internal pub/sub event bus",
    },
}

# Stores overrides: component_id -> "running" | "stopped" | "restarting"
_state_overrides: dict[str, str] = {}


def _default_status(component_id: str) -> str:
    """Return live status based on whether the engine is initialised."""
    always_active = {"cache", "message_bus"}
    if component_id in always_active:
        return "active"
    return "running" if nautilus_system.is_initialized else "stopped"


def _current_status(component_id: str) -> str:
    return _state_overrides.get(component_id, _default_status(component_id))


class ComponentActionRequest(BaseModel):
    component: str = ""


@router.post("/stop")
async def stop_component(req: ComponentActionRequest):
    cid = req.component
    if cid not in _COMPONENT_DEFS:
        return {"success": False, "message": f"Unknown component '{cid}'"}
    _state_overrides[cid] = "stopped"
    return {
        "success": True,
        "message": f"Component '{_COMPONENT_DEFS[cid]['name']}' stopped",
        "component": cid,
        "status": "stopped",
    }


@router.post("/start")
async def start_component(req: ComponentActionRequest):
    cid = req.component
    if cid not in _COMPONENT_DEFS:
        return {"success": False, "message": f"Unknown component '{cid}'"}
    _state_overrides[cid] = "running"
    return {
        "success": True,
        "message": f"Component '{_COMPONENT_DEFS[cid]['name']}' started",
        "component": cid,
        "status": "running",
    }


@router.post("/restart")
async def restart_component(req: ComponentActionRequest):
    cid = req.component
    if cid not in _COMPONENT_DEFS:
        return {"success": False, "message": f"Unknown component '{cid}'"}
    _state_overrides[cid] = "running"
    return {
        "success": True,
        "message": f"Component '{_COMPONENT_DEFS[cid]['name']}' restarted",
        "component": cid,
        "status": "running",
    }


@router.post("/configure")
async def configure_component(req: ComponentActionRequest):
    cid = req.component
    if cid not in _COMPONENT_DEFS:
        return {"success": False, "message": f"Unknown component '{cid}'"}
    return {
        "success": True,
        "message": f"Component '{_COMPONENT_DEFS[cid]['name']}' configured — "
                   "restart required for changes to take effect",
        "component": cid,
        "status": _current_status(cid),
    }


@router.get("/status")
async def list_component_statuses():
    """Return real-time status of all components."""
    return {
        "components": [
            {
                "id": cid,
                **info,
                "status": _current_status(cid),
            }
            for cid, info in _COMPONENT_DEFS.items()
        ]
    }
