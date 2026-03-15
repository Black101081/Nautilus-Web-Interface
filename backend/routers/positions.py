"""
Positions Router
================
Handles /api/positions/* endpoints.
"""

from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, HTTPException

from nautilus_core import NautilusTradingSystem

router = APIRouter()

_nautilus_system: Optional[NautilusTradingSystem] = None
_closed_position_ids: Set[str] = set()


def set_nautilus_system(system: NautilusTradingSystem) -> None:
    global _nautilus_system
    _nautilus_system = system


def _get_system() -> NautilusTradingSystem:
    if _nautilus_system is None:
        raise HTTPException(status_code=503, detail="Trading system not initialized")
    return _nautilus_system


@router.get("/api/positions")
async def list_positions():
    """List positions from all backtests."""
    all_positions: list = []
    for results in _get_system().backtest_results.values():
        all_positions.extend(results.get("positions", []))
    return all_positions[:100]


@router.post("/api/positions/{position_id}/close")
async def close_position(position_id: str):
    """Mark a position as closed (for UI purposes)."""
    _closed_position_ids.add(position_id)
    return {"success": True, "message": f"Position {position_id} closed"}
