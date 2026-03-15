from fastapi import APIRouter

from state import nautilus_system

router = APIRouter(prefix="/api", tags=["positions"])

# In-memory set of closed position IDs (no business logic lost — positions come
# from backtest results which are already immutable; close is UI-only).
_closed_position_ids: set = set()


@router.get("/positions")
async def list_positions():
    all_positions = []
    for results in nautilus_system.backtest_results.values():
        all_positions.extend(results.get("positions", []))
    return all_positions[:100]


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str):
    _closed_position_ids.add(position_id)
    return {"success": True, "message": f"Position {position_id} closed"}
