"""
LiveTradingManager — Sprint 2 (S2-01 through S2-05).

Manages the lifecycle of live adapter connections and order routing.
Wraps nautilus_trader TradingNode for live execution.

Current state:
- S2-01: LiveTradingManager class with full interface
- S2-02: connect_binance() with mock implementation (nautilus adapter TODO)
- S2-03: submit_order() / cancel_order() routing
- S2-04: sync_positions()
- S2-05: subscribe_ticker() with exponential-backoff reconnect
"""

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional


@dataclass
class AdapterConnection:
    adapter_id: str
    connection_id: str
    status: str = "connected"
    node: Any = None  # TradingNode instance when real


class LiveTradingManager:
    """
    Thread-safe manager for live adapter connections and order routing.

    All state mutating methods are guarded by asyncio.Lock.
    Can be used as a singleton (exposed via state.py).
    """

    def __init__(self) -> None:
        self._connections: Dict[str, AdapterConnection] = {}
        self._is_active: bool = False
        self._lock: asyncio.Lock = asyncio.Lock()
        self._order_callbacks: List[Callable] = []

    # ── Connection state ──────────────────────────────────────────────────────

    def is_connected(self, adapter_id: Optional[str] = None) -> bool:
        """Return True if any (or a specific) adapter is connected."""
        if adapter_id:
            conn = self._connections.get(adapter_id)
            return conn is not None and conn.status == "connected"
        return any(c.status == "connected" for c in self._connections.values())

    def get_status(self) -> Dict[str, Any]:
        """Return current live manager status dict."""
        return {
            "is_active": self._is_active,
            "connections": {
                k: {
                    "adapter_id": v.adapter_id,
                    "status": v.status,
                    "connection_id": v.connection_id,
                }
                for k, v in self._connections.items()
            },
        }

    # ── Adapter connections ───────────────────────────────────────────────────

    async def connect_binance(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """
        Connect Binance Spot adapter.

        Sprint 2: Uses mock implementation.
        Real integration with nautilus_trader.adapters.binance is TODO.
        Raises ConnectionError if credentials are clearly invalid.
        """
        async with self._lock:
            if not api_key or not api_secret:
                raise ConnectionError("api_key and api_secret are required")

            connection_id = f"CONN-BINANCE-{uuid.uuid4().hex[:8].upper()}"
            self._connections["binance"] = AdapterConnection(
                adapter_id="binance",
                connection_id=connection_id,
                status="connected",
            )
            self._is_active = True
            return {"success": True, "connection_id": connection_id}

    async def connect_bybit(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """Connect Bybit adapter (Sprint 4 TODO)."""
        async with self._lock:
            if not api_key or not api_secret:
                raise ConnectionError("api_key and api_secret are required")
            connection_id = f"CONN-BYBIT-{uuid.uuid4().hex[:8].upper()}"
            self._connections["bybit"] = AdapterConnection(
                adapter_id="bybit",
                connection_id=connection_id,
                status="connected",
            )
            self._is_active = True
            return {"success": True, "connection_id": connection_id}

    async def disconnect(self, adapter_id: str) -> Dict[str, Any]:
        """Disconnect a specific adapter and update internal state."""
        async with self._lock:
            conn = self._connections.get(adapter_id)
            if conn:
                conn.status = "disconnected"
            # Deactivate node if no more active connections
            if not self.is_connected():
                self._is_active = False
            return {"success": True}

    # ── Order management ──────────────────────────────────────────────────────

    async def submit_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit an order to the exchange.

        Raises RuntimeError if no adapter is connected.
        Sprint 2: Mock implementation; real TradingNode routing is TODO.
        """
        if not self.is_connected():
            raise RuntimeError("No adapter connected. Connect an exchange adapter first.")
        exchange_order_id = f"EXCHANGE-{uuid.uuid4().hex[:8].upper()}"
        return {
            "success": True,
            "order_id": exchange_order_id,
            "exchange_order_id": exchange_order_id,
            "status": "pending",
            "exchange": "BINANCE",
        }

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancel an order on the exchange."""
        if not self.is_connected():
            raise RuntimeError("No adapter connected.")
        return {"success": True, "order_id": order_id}

    async def sync_positions(self) -> List[Dict[str, Any]]:
        """
        Fetch open positions from the exchange.

        Returns empty list if not connected.
        Sprint 2: Mock returns empty; real account state query is TODO.
        """
        if not self.is_connected():
            return []
        # TODO: query TradingNode for account positions
        return []

    # ── Market data WebSocket ─────────────────────────────────────────────────

    async def _connect_ws(
        self, symbol: str, on_message: Callable, backoff: float = 1.0
    ) -> None:
        """
        Open a single WebSocket session to the Binance ticker stream.
        Raises on disconnect (caller handles reconnect).
        """
        import websockets  # type: ignore

        url = f"wss://stream.binance.com:9443/ws/{symbol.lower()}@ticker"
        async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
            async for raw in ws:
                data = json.loads(raw)
                await on_message(data)

    async def subscribe_ticker(
        self, symbol: str, on_message: Callable, backoff: float = 1.0
    ) -> None:
        """
        Subscribe to Binance WebSocket ticker stream with exponential-backoff reconnect.

        Runs forever — cancel the task to stop.
        backoff: initial wait (seconds) between reconnects; doubles on each failure.
        """
        max_backoff = 60.0
        current_backoff = backoff

        while True:
            try:
                await self._connect_ws(symbol, on_message, current_backoff)
                current_backoff = backoff  # reset on clean disconnect
                await asyncio.sleep(0)  # yield so cancellation / timeout can fire
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(current_backoff)
                current_backoff = min(current_backoff * 2, max_backoff)


async def process_order_update(update: Dict[str, Any]) -> None:
    """
    Process an order status update received from the exchange WebSocket.
    Updates the order status in the DB.

    Sprint 2 (S2-03): Called when exchange sends fill notifications.
    """
    import database

    exchange_order_id = update.get("orderId", "")
    status = update.get("status", "").lower()
    executed_qty = float(update.get("executedQty", 0))

    if not exchange_order_id:
        return

    # Map exchange status to our DB status
    status_map = {
        "filled": "filled",
        "partially_filled": "partial",
        "canceled": "CANCELLED",
        "cancelled": "CANCELLED",
        "rejected": "rejected",
        "pending": "PENDING",
        "new": "PENDING",
    }
    db_status = status_map.get(status, status)

    # Update order in DB by exchange_order_id
    async with database.aiosqlite.connect(database.DB_PATH) as db:
        await db.execute(
            "UPDATE orders SET status=?, filled_qty=? WHERE exchange_order_id=?",
            (db_status, executed_qty, exchange_order_id),
        )
        await db.commit()
