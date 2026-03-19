"""
Binance exchange adapter wrapper — Sprint 2 (S2-02).

Wraps the LiveTradingManager for the Binance exchange.
Provides the interface contract expected by tests.
"""

from typing import Any, Callable, Dict, List, Optional


class BinanceAdapter:
    """
    Binance Spot exchange adapter.

    Interface contract:
        connect(api_key, api_secret) → dict with 'success', 'connection_id'
        disconnect() → dict with 'success'
        subscribe_ticker(symbol, callback) → None (async streaming)
        get_balance() → dict
        submit_order(order) → dict with 'success', 'exchange_order_id'
    """

    def __init__(self) -> None:
        self._connection_id: Optional[str] = None
        self._connected: bool = False

    async def connect(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """Connect to Binance using the LiveTradingManager."""
        from live_trading import LiveTradingManager
        import uuid

        mgr = LiveTradingManager()
        result = await mgr.connect_binance(api_key, api_secret)
        self._connection_id = result.get("connection_id", "")
        self._connected = result.get("success", False)
        return {
            "success": self._connected,
            "connection_id": self._connection_id,
            "exchange": "BINANCE",
        }

    async def disconnect(self) -> Dict[str, Any]:
        """Disconnect from Binance."""
        self._connected = False
        return {"success": True}

    async def subscribe_ticker(self, symbol: str, on_message: Callable) -> None:
        """Subscribe to real-time ticker data via WebSocket."""
        from live_trading import LiveTradingManager
        mgr = LiveTradingManager()
        await mgr.subscribe_ticker(symbol, on_message)

    async def get_balance(self) -> Dict[str, Any]:
        """Get account balance (mock for Sprint 2)."""
        return {"USDT": {"free": 10000.0, "locked": 0.0}}

    async def submit_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """Submit an order to Binance."""
        from live_trading import LiveTradingManager
        mgr = LiveTradingManager()
        return await mgr.submit_order(order)
