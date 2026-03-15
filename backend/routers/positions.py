"""
Positions router.

Open positions are read from the DB positions table (persisted after each
backtest run).  The UI-layer close action marks them as closed in the DB.
Current prices are enriched from market_data_service when the instrument
matches a supported crypto symbol (e.g. BTCUSDT).
"""

import asyncio
import logging
from typing import Any, Dict, List

from fastapi import APIRouter

import database
import market_data_service as svc
from state import live_manager, nautilus_system

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["positions"])


async def _enrich_current_prices(positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Best-effort: add current_price and live unrealized_pnl to each position."""
    if not positions:
        return positions

    # Gather unique symbols that market_data_service knows about
    symbols_needed = {
        p["instrument"].upper()
        for p in positions
        if p.get("instrument", "").upper() in svc.SYMBOLS
    }

    if not symbols_needed:
        return positions

    # Fetch all needed prices concurrently
    price_map: Dict[str, float] = {}
    async def _fetch(sym: str) -> None:
        try:
            data = await svc.get_symbol_data(sym)
            price_map[sym] = data.get("price", 0.0)
        except Exception:
            pass  # keep whatever is already in DB

    await asyncio.gather(*[_fetch(s) for s in symbols_needed])

    enriched = []
    for pos in positions:
        p = dict(pos)
        sym = p.get("instrument", "").upper()
        if sym in price_map and price_map[sym] > 0:
            current = price_map[sym]
            p["current_price"] = current
            # Recompute unrealized PnL when entry_price is available
            entry = float(p.get("entry_price") or 0)
            qty = float(p.get("quantity") or 0)
            if entry > 0 and qty > 0:
                side = str(p.get("side", "")).upper()
                multiplier = 1.0 if "LONG" in side or "BUY" in side else -1.0
                p["pnl"] = round((current - entry) * qty * multiplier, 4)
        enriched.append(p)
    return enriched


@router.get("/positions")
async def list_positions():
    # Primary: DB-persisted positions (survive restarts, reflect latest backtest)
    db_positions = await database.list_db_positions(open_only=True)

    # Determine data source
    source = "live" if live_manager.is_connected() else "cached"

    if db_positions:
        enriched = await _enrich_current_prices(db_positions)
        for pos in enriched:
            pos["source"] = source
        return enriched

    # Fallback: in-memory backtest results (before first backtest persists to DB)
    all_positions = []
    for results in nautilus_system.backtest_results.values():
        all_positions.extend(results.get("positions", []))
    open_pos = [p for p in all_positions if p.get("is_open", False)]
    enriched = await _enrich_current_prices(open_pos)
    for pos in enriched:
        pos["source"] = source
    return enriched


@router.post("/positions/sync")
async def sync_positions():
    """Sync open positions from the connected exchange."""
    live_positions = await live_manager.sync_positions()

    # Persist synced positions to DB
    if live_positions:
        await database.save_positions(live_positions)

    return {
        "success": True,
        "synced_count": len(live_positions),
        "positions": live_positions,
    }


@router.post("/positions/{position_id}/close")
async def close_position(position_id: str):
    # If adapter connected, send a close order to the exchange
    if live_manager.is_connected():
        try:
            # Fetch position from DB to get side/instrument
            positions = await database.list_db_positions(open_only=False)
            target = next((p for p in positions if p["id"] == position_id), None)
            close_side = "SELL"
            instrument = "UNKNOWN"
            quantity = 0.0
            if target:
                instrument = target.get("instrument", "UNKNOWN")
                quantity = float(target.get("quantity", 0))
                pos_side = str(target.get("side", "LONG")).upper()
                close_side = "SELL" if "LONG" in pos_side or "BUY" in pos_side else "BUY"

            await live_manager.submit_order({
                "instrument": instrument,
                "side": close_side,
                "type": "MARKET",
                "quantity": quantity,
            })
        except Exception as exc:
            logger.warning("Exchange close order failed: %s", exc)

    closed = await database.close_db_position(position_id)
    return {"success": True, "closed_in_db": closed, "message": f"Position {position_id} closed"}
