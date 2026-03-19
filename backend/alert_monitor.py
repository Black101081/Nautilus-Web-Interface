"""
Alert Monitor
=============
Background asyncio task that evaluates active price alerts against live
market data every CHECK_INTERVAL seconds.

When a condition is met the alert is marked 'triggered' in the DB and
a WebSocket broadcast is sent to all connected clients.
"""

import asyncio
import logging

import database
import market_data_service as svc

logger = logging.getLogger(__name__)

_CHECK_INTERVAL = 10  # seconds between evaluation passes


async def run_alert_monitor() -> None:
    """
    Entry point — run forever, cancelled cleanly on shutdown.
    Call this once from the FastAPI lifespan with asyncio.create_task().
    """
    logger.info("Alert monitor started (interval=%ds)", _CHECK_INTERVAL)
    while True:
        try:
            await _check_alerts()
        except asyncio.CancelledError:
            logger.info("Alert monitor stopped")
            break
        except Exception as exc:
            # Never crash the monitor — log and keep going
            logger.warning("Alert monitor error: %s", exc)
        await asyncio.sleep(_CHECK_INTERVAL)


async def _check_alerts() -> None:
    """Fetch active alerts and trigger any whose condition is satisfied."""
    alerts = await database.list_active_alerts()
    if not alerts:
        return

    for alert in alerts:
        symbol = alert["symbol"].upper()
        if symbol not in svc.SYMBOLS:
            # Symbol not tracked by market data service — skip silently
            continue

        try:
            data = await svc.get_symbol_data(symbol)
            current_price: float = data.get("price", 0.0)
        except Exception as exc:
            logger.debug("Could not fetch price for %s: %s", symbol, exc)
            continue

        condition = alert["condition"]
        target = float(alert["price"])

        triggered = (
            (condition == "above" and current_price >= target)
            or (condition == "below" and current_price <= target)
        )

        if triggered:
            updated = await database.trigger_alert(alert["id"])
            if updated:
                logger.info(
                    "Alert %s TRIGGERED: %s %s %.6f (current price %.6f)",
                    alert["id"],
                    symbol,
                    condition,
                    target,
                    current_price,
                )
                # Broadcast to WebSocket clients
                await _broadcast_alert_triggered(alert, current_price)


async def _broadcast_alert_triggered(alert: dict, current_price: float) -> None:
    """Push an alert_triggered event to all connected WebSocket clients."""
    try:
        from state import manager

        await manager.broadcast(
            {
                "type": "alert_triggered",
                "alert_id": alert["id"],
                "symbol": alert["symbol"],
                "condition": alert["condition"],
                "target_price": alert["price"],
                "current_price": current_price,
                "message": alert.get("message", ""),
            }
        )
    except Exception as exc:
        logger.debug("WebSocket broadcast failed: %s", exc)
