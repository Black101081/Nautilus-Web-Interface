"""Shared utilities used by multiple routers."""

from typing import Any, Dict


def normalize_order(o: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize raw Nautilus order/trade dicts to a clean frontend-safe format.
    Handles Rust enum repr strings like '<OrderSide.BUY: 1>' → 'BUY'.
    """
    side_raw = str(o.get("side", ""))
    side = "BUY" if "BUY" in side_raw else "SELL" if "SELL" in side_raw else side_raw
    status_raw = str(o.get("status", ""))
    status = "FILLED" if "FILLED" in status_raw else status_raw
    return {
        "id": o.get("id", ""),
        "instrument": o.get("instrument_id", ""),
        "side": side,
        "type": "MARKET",
        "quantity": o.get("quantity", 0),
        "price": o.get("avg_px"),
        "status": status,
        "filled_qty": o.get("filled_qty", 0),
    }
