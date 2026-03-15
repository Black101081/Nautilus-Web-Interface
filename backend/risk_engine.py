"""
Risk enforcement engine — Sprint 3 (S3-03).

Checks risk limits before allowing any order to be created.
All four checks must pass; the first failure raises RiskCheckError (HTTP 422).
"""

from datetime import date
from typing import Any, Dict

from fastapi import HTTPException


class RiskCheckError(HTTPException):
    """Raised when an order violates a risk limit."""

    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=422,
            detail={"error": "risk_limit_exceeded", "message": detail},
        )


class RiskEngine:
    """Stateless risk checker — reads limits live from DB on each call."""

    async def check_order(self, order: Dict[str, Any]) -> None:
        """
        Run all risk checks for the given order dict.
        Raises RiskCheckError if any check fails.
        """
        import database

        limits = await database.get_risk_limits()

        await self._check_max_position_size(order, limits)
        await self._check_daily_loss_limit(limits)
        await self._check_leverage(order, limits)
        await self._check_orders_per_day(limits)

    # ── Individual checks ─────────────────────────────────────────────────────

    async def _check_max_position_size(
        self, order: Dict[str, Any], limits: Dict[str, Any]
    ) -> None:
        max_pos = float(limits.get("max_position_size", 0))
        if not max_pos or max_pos <= 0:
            return  # Unlimited

        quantity = float(order.get("quantity", 0))
        price = float(order.get("price") or 0)

        # Only check if price is explicitly provided; MARKET orders without
        # a price cannot be reliably valued at submission time.
        if price == 0:
            return

        order_value = quantity * price
        if order_value > max_pos:
            raise RiskCheckError(
                f"Order value {order_value:.2f} exceeds max_position_size limit of {max_pos:.2f}"
            )

    async def _check_daily_loss_limit(self, limits: Dict[str, Any]) -> None:
        max_loss = float(limits.get("max_daily_loss", 0))
        if not max_loss or max_loss <= 0:
            return  # Unlimited

        import database

        daily_loss = await database.get_daily_realized_loss()
        if abs(daily_loss) > max_loss:
            # Auto-stop all running strategies
            await self._auto_stop_strategies_on_loss(daily_loss, max_loss)
            raise RiskCheckError(
                f"Daily realized loss {abs(daily_loss):.2f} exceeds "
                f"max_daily_loss limit of {max_loss:.2f}. Trading halted until tomorrow."
            )

    async def _auto_stop_strategies_on_loss(
        self, daily_loss: float, max_loss: float
    ) -> None:
        """Stop all running strategies when daily loss limit is breached."""
        try:
            import database
            from state import nautilus_system
            strategies = await database.list_strategies()
            for s in strategies:
                if s.get("status") == "running":
                    await database.update_strategy_status(s["id"], "stopped")
                    if s["id"] in nautilus_system.strategies:
                        nautilus_system.strategies[s["id"]]["status"] = "stopped"
        except Exception:
            pass  # Best-effort; never block the main risk check

    async def _check_leverage(
        self, order: Dict[str, Any], limits: Dict[str, Any]
    ) -> None:
        max_lev = float(limits.get("max_leverage", 0))
        if not max_lev or max_lev <= 0:
            return  # Unlimited

        order_leverage = float(order.get("leverage", 1.0))
        if order_leverage > max_lev:
            raise RiskCheckError(
                f"Order leverage {order_leverage}x exceeds max_leverage limit of {max_lev}x"
            )

    async def _check_orders_per_day(self, limits: Dict[str, Any]) -> None:
        max_orders = int(limits.get("max_orders_per_day", 0))
        if not max_orders or max_orders <= 0:
            return  # Unlimited

        import database

        today_count = await database.count_orders_today()
        if today_count >= max_orders:
            raise RiskCheckError(
                f"Daily order limit of {max_orders} reached "
                f"({today_count} orders placed today)."
            )


    async def check_daily_loss_auto_stop(self) -> None:
        """
        Check daily loss limit and auto-stop all running strategies if exceeded.
        Called from list_strategies to ensure state is up-to-date.
        Does NOT raise — only auto-stops strategies as a side-effect.
        """
        try:
            import database
            limits = await database.get_risk_limits()
            max_loss = float(limits.get("max_daily_loss", 0))
            if not max_loss or max_loss <= 0:
                return
            daily_loss = await database.get_daily_realized_loss()
            if abs(daily_loss) > max_loss:
                await self._auto_stop_strategies_on_loss(daily_loss, max_loss)
        except Exception:
            pass  # Best-effort


# ── Module-level singleton ────────────────────────────────────────────────────

risk_engine = RiskEngine()
