"""
Positions router.

Open positions are read from the DB positions table (persisted after each
backtest run).  The UI-layer close action marks them as closed in the DB.
"""

from fastapi import APIRouter

import database
from state import nautilus_system

router = APIRouter(prefix="/api", tags=["positions"])


@router.get("/positions")
async def list_positions():
    # Primary: DB-persisted positions (survive restarts, reflect latest backtest)
    db_positions = await database.list_db_positions(open_only=True)

    if db_positions:
        return db_positions[:100]

    # Fallback: in-memory backtest results (before first backtest persists to DB)
    all_positions = []
    for results in nautilus_system.backtest_results.values():
        all_positions.extend(results.get("positions", []))
    return [p for p in all_positions if p.get("is_open", False)][:100]


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str):
    closed = await database.close_db_position(position_id)
    return {"success": True, "closed_in_db": closed, "message": f"Position {position_id} closed"}
