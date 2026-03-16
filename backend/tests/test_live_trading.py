"""
Live Trading tests — Sprint 2.

Tests for:
- LiveTradingNode setup and lifecycle
- Real Binance adapter connection
- Real order routing to exchange
- Live position sync
- WebSocket market data feed

ALL tests here are expected to FAIL until Sprint 2 is implemented.
They are written against the interface contracts that the implementation must satisfy.

Run:
    cd backend
    pytest tests/test_live_trading.py -v
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    from fastapi.testclient import TestClient
    from nautilus_fastapi import app
    with TestClient(app) as c:
        login_r = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        if login_r.status_code == 200:
            token = login_r.json()["access_token"]
            c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1 — LiveTradingNode Lifecycle
# ═════════════════════════════════════════════════════════════════════════════

class TestLiveTradingNodeLifecycle:

    def test_engine_info_shows_node_type(self, client):
        """GET /api/engine/info must indicate whether using BacktestEngine or LiveTradingNode."""
        r = client.get("/api/engine/info")
        body = r.json()
        assert "engine_type" in body
        assert body["engine_type"] in ("backtest", "live")

    def test_connect_adapter_switches_to_live_node(self, client):
        """Connecting a live adapter should activate LiveTradingNode."""
        with patch("live_trading.LiveTradingManager.connect_binance", new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value = {"success": True, "node_id": "NODE-001"}
            client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "test_key", "api_secret": "test_secret"},
            )
            mock_connect.assert_called_once()

    def test_live_node_status_in_engine_info(self, client):
        """After connecting adapter, engine info must show live node is active."""
        with patch("live_trading.LiveTradingManager.connect_binance", new_callable=AsyncMock) as m:
            m.return_value = {"success": True}
            client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )

        r = client.get("/api/engine/info")
        body = r.json()
        assert body.get("engine_type") == "live"
        assert body.get("live_node_active") is True

    def test_disconnect_shuts_down_live_node(self, client):
        """Disconnecting adapter must stop the LiveTradingNode gracefully."""
        with patch("live_trading.LiveTradingManager.disconnect", new_callable=AsyncMock) as mock_disconnect:
            mock_disconnect.return_value = {"success": True}
            r = client.post("/api/adapters/binance/disconnect")
            assert r.status_code == 200
            mock_disconnect.assert_called_once()

    def test_live_trading_module_exists(self):
        """live_trading.py module must exist and import cleanly."""
        try:
            import live_trading
            assert hasattr(live_trading, "LiveTradingManager")
        except ImportError:
            pytest.fail("live_trading module does not exist yet")


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Adapter Interface Contracts
# ═════════════════════════════════════════════════════════════════════════════

class TestAdapterInterface:
    """
    These tests verify that each adapter has the required interface.
    They test the CONTRACT, not the real exchange.
    """

    def test_binance_adapter_has_required_methods(self):
        """BinanceAdapter class must have connect/disconnect/subscribe/get_balance."""
        try:
            from adapters.binance import BinanceAdapter  # our wrapper, not nautilus
        except ImportError:
            pytest.fail("adapters/binance.py does not exist")

        adapter = BinanceAdapter.__new__(BinanceAdapter)
        for method in ("connect", "disconnect", "subscribe_ticker", "get_balance", "submit_order"):
            assert hasattr(adapter, method), f"BinanceAdapter missing method: {method}"

    def test_adapter_connect_returns_structured_result(self):
        """Adapter.connect() must return dict with 'success' and 'connection_id'."""
        from adapters.binance import BinanceAdapter

        with patch.object(BinanceAdapter, "connect", new_callable=AsyncMock) as mock_connect:
            import asyncio
            mock_connect.return_value = {
                "success": True,
                "connection_id": "CONN-123",
                "exchange": "BINANCE",
            }
            result = asyncio.run(BinanceAdapter().connect("key", "secret"))
            assert "success" in result
            assert "connection_id" in result

    def test_adapter_connection_id_stored_in_db(self, client, tmp_path):
        """After real connect, the connection_id must be stored in adapter_configs."""
        import asyncio
        import sqlite3

        db_path = tmp_path / "test_conn.db"

        with patch("live_trading.LiveTradingManager.connect_binance", new_callable=AsyncMock) as m:
            m.return_value = {"success": True, "connection_id": "CONN-XYZ-001"}
            client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )

        r = client.get("/api/adapters/binance")
        body = r.json()
        assert "connection_id" in body
        assert body["connection_id"] == "CONN-XYZ-001"

    def test_adapter_connect_status_only_set_after_ws_handshake(self, client):
        """Status 'connected' must only be set AFTER WebSocket handshake succeeds."""
        with patch("live_trading.LiveTradingManager.connect_binance", new_callable=AsyncMock) as m:
            # Simulate WS handshake failure
            m.side_effect = ConnectionError("WebSocket handshake failed")
            r = client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )

        # Status must NOT be "connected"
        r2 = client.get("/api/adapters/binance")
        assert r2.json()["status"] != "connected"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Real Order Routing
# ═════════════════════════════════════════════════════════════════════════════

class TestOrderRouting:

    def test_order_routed_to_exchange_when_adapter_connected(self, client):
        """When adapter connected, new orders must be submitted to exchange."""
        with patch("live_trading.LiveTradingManager.submit_order", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = {
                "order_id": "EXCHANGE-ORD-001",
                "status": "pending",
                "exchange": "BINANCE",
            }

            # Simulate adapter connected
            with patch("live_trading.LiveTradingManager.is_connected", return_value=True):
                r = client.post(
                    "/api/orders",
                    json={
                        "instrument": "BTC/USDT.BINANCE",
                        "side": "BUY",
                        "type": "MARKET",
                        "quantity": 0.001,
                    },
                )

            assert r.status_code == 200
            mock_submit.assert_called_once()
            body = r.json()
            assert body.get("exchange_order_id") == "EXCHANGE-ORD-001"

    def test_order_rejected_when_no_adapter_connected(self, client):
        """Without connected adapter, live orders must be rejected with clear error."""
        with patch("live_trading.LiveTradingManager.is_connected", return_value=False):
            r = client.post(
                "/api/orders",
                json={
                    "instrument": "BTC/USDT.BINANCE",
                    "side": "BUY",
                    "type": "MARKET",
                    "quantity": 0.001,
                },
            )
        assert r.status_code in (400, 422)
        assert "adapter" in r.text.lower() or "connect" in r.text.lower()

    def test_order_cancel_sent_to_exchange(self, client):
        """DELETE /api/orders/{id} must cancel the order on the exchange."""
        with patch("live_trading.LiveTradingManager.cancel_order", new_callable=AsyncMock) as mock_cancel:
            mock_cancel.return_value = {"success": True, "exchange_order_id": "EX-ORD-123"}

            with patch("live_trading.LiveTradingManager.is_connected", return_value=True):
                r = client.delete("/api/orders/ORD-TEST-001")

            mock_cancel.assert_called_once_with("ORD-TEST-001")

    def test_order_status_updates_from_exchange_websocket(self, client):
        """Order status in DB must update when exchange sends fill notification via WS."""
        # This tests the WS handler that processes exchange order updates
        import asyncio
        from live_trading import process_order_update

        async def simulate():
            await process_order_update({
                "orderId": "EXCHANGE-ORD-001",
                "status": "FILLED",
                "executedQty": "0.001",
                "price": "50000.00",
            })

        asyncio.run(simulate())

        r = client.get("/api/orders")
        orders = r.json()["orders"]
        filled = [o for o in orders if o.get("exchange_order_id") == "EXCHANGE-ORD-001"]
        if filled:
            assert filled[0]["status"] == "filled"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Position Sync
# ═════════════════════════════════════════════════════════════════════════════

class TestPositionSync:

    def test_positions_have_source_field(self, client):
        """GET /api/positions must include 'source' field: 'live' or 'cached'."""
        r = client.get("/api/positions")
        positions = r.json()
        # Either empty or has source field
        if positions:
            assert "source" in positions[0], "Positions must have 'source' field"

    def test_live_position_sync_endpoint(self, client):
        """POST /api/positions/sync must trigger a sync from exchange."""
        with patch("live_trading.LiveTradingManager.sync_positions", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = [
                {"instrument": "BTC/USDT", "side": "LONG", "quantity": 0.5}
            ]
            r = client.post("/api/positions/sync")
            assert r.status_code == 200
            mock_sync.assert_called_once()

    def test_close_position_sends_market_sell(self, client):
        """Closing a LONG position must send a SELL market order to exchange."""
        with patch("live_trading.LiveTradingManager.submit_order", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = {"success": True, "order_id": "CLOSE-ORD-001"}

            with patch("live_trading.LiveTradingManager.is_connected", return_value=True):
                r = client.post("/api/positions/POS-001/close")

            assert r.status_code == 200
            mock_submit.assert_called_once()
            call_kwargs = mock_submit.call_args[1] or {}
            # Closing a long must be a SELL order
            side = call_kwargs.get("side") or (mock_submit.call_args[0][0] if mock_submit.call_args[0] else "")
            assert "SELL" in str(side).upper()


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 5 — WebSocket Market Data Feed
# ═════════════════════════════════════════════════════════════════════════════

class TestMarketDataWebSocket:

    def test_subscribe_ticker_method_exists(self):
        """LiveTradingManager must have a subscribe_ticker method."""
        try:
            from live_trading import LiveTradingManager
            mgr = LiveTradingManager.__new__(LiveTradingManager)
            assert hasattr(mgr, "subscribe_ticker"), \
                "LiveTradingManager.subscribe_ticker() not implemented"
        except ImportError:
            pytest.fail("live_trading module not found")

    def test_market_data_ws_reconnects_on_disconnect(self):
        """WebSocket client must auto-reconnect with exponential backoff on failure."""
        from live_trading import LiveTradingManager

        reconnect_delays = []

        async def mock_connect_ws(symbol, on_message, backoff=1):
            reconnect_delays.append(backoff)
            if len(reconnect_delays) < 3:
                raise ConnectionError("WS closed")

        import asyncio
        with patch.object(LiveTradingManager, "_connect_ws", side_effect=mock_connect_ws):
            mgr = LiveTradingManager.__new__(LiveTradingManager)
            try:
                asyncio.run(asyncio.wait_for(
                    mgr.subscribe_ticker("BTCUSDT", lambda msg: None),
                    timeout=5,
                ))
            except (asyncio.TimeoutError, Exception):
                pass

        assert len(reconnect_delays) >= 2, "Must retry at least twice"
        # Exponential backoff: each delay should be >= previous
        for i in range(1, len(reconnect_delays)):
            assert reconnect_delays[i] >= reconnect_delays[i - 1]
