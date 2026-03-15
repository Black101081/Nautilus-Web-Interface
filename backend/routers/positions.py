from fastapi import APIRouter

from state import nautilus_system

router = APIRouter(prefix="/api", tags=["positions"])

# Tracks position IDs that the user has explicitly closed via the UI.
# Since positions come from immutable backtest snapshots, this set acts as
# a UI-layer override so closed positions are hidden from the list.
_closed_position_ids: set = set()


@router.get("/positions")
async def list_positions():
    all_positions = []
    for results in nautilus_system.backtest_results.values():
        all_positions.extend(results.get("positions", []))

    # Filter out positions the user has closed and engine-closed positions
    visible = [
        p for p in all_positions
        if p.get("id") not in _closed_position_ids and p.get("is_open", False)
    ]
    return visible[:100]


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str):
    _closed_position_ids.add(position_id)
    return {"success": True, "message": f"Position {position_id} closed"}
