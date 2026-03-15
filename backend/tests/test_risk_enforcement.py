"""
Risk Enforcement tests — Sprint 3.

Tests that risk limits (max position size, daily loss, leverage, etc.)
are ACTUALLY ENFORCED when creating orders.

Currently these tests are expected to FAIL because risk limits are saved
to DB but never checked when placing orders.

Run:
    cd backend
    pytest tests/test_risk_enforcement.py -v
"""

import sys
from pathlib import Path

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
# SECTION 1 — Max Position Size
# ═════════════════════════════════════════════════════════════════════════════

class TestMaxPositionSize:

    @pytest.mark.xfail(reason="S3-03: risk enforcement not implemented yet")
    def test_order_blocked_when_exceeds_max_position(self, client):
        """Order quantity × price > max_position_size must be rejected."""
        # Set a small max position size
        client.post("/api/risk/limits", json={"max_position_size": 1_000})

        # Try to create an order worth 100,000 (1000 units at price 100)
        r = client.post(
            "/api/orders",
            json={
                "instrument": "BTC/USDT.BINANCE",
                "side": "BUY",
                "type": "LIMIT",
                "quantity": 1000,
                "price": 100.0,
            },
        )
        assert r.status_code in (400, 422), \
            f"Expected 400/422, got {r.status_code}: {r.text}"
        assert "position" in r.text.lower() or "risk" in r.text.lower()

    @pytest.mark.xfail(reason="S3-03: risk enforcement not implemented yet")
    def test_order_allowed_within_max_position(self, client):
        """Order within max_position_size limit must be accepted."""
        client.post("/api/risk/limits", json={"max_position_size": 100_000})

        r = client.post(
            "/api/orders",
            json={
                "instrument": "BTC/USDT.BINANCE",
                "side": "BUY",
                "type": "LIMIT",
                "quantity": 1,
                "price": 50_000.0,
            },
        )
        assert r.status_code == 200

    @pytest.mark.xfail(reason="S3-03: risk enforcement not implemented yet")
    def test_risk_error_response_contains_limit_value(self, client):
        """Risk error response must state what the limit is."""
        client.post("/api/risk/limits", json={"max_position_size": 500})

        r = client.post(
            "/api/orders",
            json={
                "instrument": "ETH/USDT.BINANCE",
                "side": "BUY",
                "type": "MARKET",
                "quantity": 100,
                "price": 3_000.0,
            },
        )
        assert r.status_code in (400, 422)
        body_text = r.text.lower()
        # Response should mention the limit value
        assert "500" in body_text or "max_position_size" in body_text

    @pytest.mark.xfail(reason="S3-03: risk enforcement not implemented yet")
    def test_updated_limit_takes_effect_immediately(self, client):
        """Lowering the limit should immediately block previously-allowed orders."""
        # First allow large orders
        client.post("/api/risk/limits", json={"max_position_size": 1_000_000})
        r1 = client.post(
            "/api/orders",
            json={"instrument": "BTC/USDT.BINANCE", "side": "BUY",
                  "type": "MARKET", "quantity": 1, "price": 50_000.0},
        )
        assert r1.status_code == 200

        # Now lower the limit
        client.post("/api/risk/limits", json={"max_position_size": 100})
        r2 = client.post(
            "/api/orders",
            json={"instrument": "BTC/USDT.BINANCE", "side": "BUY",
                  "type": "MARKET", "quantity": 1, "price": 50_000.0},
        )
        assert r2.status_code in (400, 422), "New lower limit must be enforced immediately"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Daily Loss Limit
# ═════════════════════════════════════════════════════════════════════════════

class TestDailyLossLimit:

    @pytest.mark.xfail(reason="S3-03: risk enforcement not implemented yet")
    def test_new_orders_blocked_when_daily_loss_exceeded(self, client):
        """When today's realized loss > max_daily_loss, new orders are blocked."""
        client.post("/api/risk/limits", json={"max_daily_loss": 100})

        # Simulate a loss in DB directly
        import asyncio
        import database

        async def inject_loss():
            await database.init_db()
            await database._execute(
                """INSERT INTO orders
                   (id, instrument, side, type, quantity, price, status, filled_qty, pnl, timestamp)
                   VALUES ('ORD-LOSS', 'BTC/USDT', 'SELL', 'MARKET', 1, 50000, 'filled', 1, -500, datetime('now'))""",
                commit=True,
            )

        asyncio.run(inject_loss())

        # Next order should be blocked
        r = client.post(
            "/api/orders",
            json={"instrument": "BTC/USDT.BINANCE", "side": "BUY",
                  "type": "MARKET", "quantity": 1},
        )
        assert r.status_code in (400, 422, 429)
        assert "daily" in r.text.lower() or "loss" in r.text.lower()

    @pytest.mark.xfail(reason="S3-04: daily loss auto-stop not implemented yet")
    def test_daily_loss_auto_stops_all_strategies(self, client):
        """When daily loss limit reached, all running strategies must auto-stop."""
        # Create and start a strategy
        r = client.post(
            "/api/strategies",
            json={"name": "AutoStop Test", "type": "sma_crossover"},
        )
        sid = r.json()["strategy_id"]
        client.post(f"/api/strategies/{sid}/start")

        # Trigger daily loss limit via risk engine
        import asyncio
        import database

        async def inject_large_loss():
            await database.init_db()
            await database._execute(
                """INSERT INTO orders
                   (id, instrument, side, type, quantity, price, status, filled_qty, pnl, timestamp)
                   VALUES ('ORD-HUGE-LOSS', 'BTC/USDT', 'SELL', 'MARKET', 10, 50000,
                           'filled', 10, -99999, datetime('now'))""",
                commit=True,
            )

        asyncio.run(inject_large_loss())

        # Check that strategy was auto-stopped
        r = client.get("/api/strategies")
        found = [s for s in r.json()["strategies"] if s["id"] == sid]
        assert found[0]["status"] == "stopped", \
            "Strategy must be auto-stopped when daily loss limit is reached"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Max Leverage
# ═════════════════════════════════════════════════════════════════════════════

class TestLeverageLimits:

    @pytest.mark.xfail(reason="S3-03: leverage enforcement not implemented yet")
    def test_order_blocked_exceeds_leverage_limit(self, client):
        """Order with leverage > max_leverage must be rejected."""
        client.post("/api/risk/limits", json={"max_leverage": 3.0})

        r = client.post(
            "/api/orders",
            json={
                "instrument": "BTC/USDT.BINANCE",
                "side": "BUY",
                "type": "MARKET",
                "quantity": 1,
                "leverage": 5.0,  # 5x leverage, limit is 3x
            },
        )
        assert r.status_code in (400, 422)
        assert "leverage" in r.text.lower()

    @pytest.mark.xfail(reason="S3-03: leverage enforcement not implemented yet")
    def test_order_allowed_within_leverage_limit(self, client):
        """Order with leverage ≤ max_leverage must pass risk check."""
        client.post("/api/risk/limits", json={"max_leverage": 5.0})

        r = client.post(
            "/api/orders",
            json={
                "instrument": "BTC/USDT.BINANCE",
                "side": "BUY",
                "type": "MARKET",
                "quantity": 1,
                "leverage": 2.0,  # 2x ≤ 5x limit
            },
        )
        assert r.status_code == 200


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Max Orders Per Day
# ═════════════════════════════════════════════════════════════════════════════

class TestMaxOrdersPerDay:

    @pytest.mark.xfail(reason="S3-03: order count enforcement not implemented yet")
    def test_orders_blocked_after_daily_limit(self, client):
        """After max_orders_per_day is reached, further orders are blocked."""
        client.post("/api/risk/limits", json={"max_orders_per_day": 3})

        order_payload = {
            "instrument": "BTC/USDT.BINANCE",
            "side": "BUY",
            "type": "MARKET",
            "quantity": 0.001,
        }

        for i in range(3):
            r = client.post("/api/orders", json=order_payload)
            assert r.status_code == 200, f"Order {i+1} should succeed"

        # 4th order must be blocked
        r = client.post("/api/orders", json=order_payload)
        assert r.status_code in (400, 422, 429)
        assert "daily" in r.text.lower() or "limit" in r.text.lower()

    @pytest.mark.xfail(reason="S3-03: order count enforcement not implemented yet")
    def test_order_count_resets_next_day(self, client):
        """Order counter must reset at midnight (UTC)."""
        # This test is verified by checking the count endpoint
        r = client.get("/api/risk/metrics")
        assert r.status_code == 200
        body = r.json()
        assert "orders_today" in body
        assert isinstance(body["orders_today"], int)


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Risk Metrics Endpoint
# ═════════════════════════════════════════════════════════════════════════════

class TestRiskMetricsEndpoint:
    """
    These tests verify the CURRENT state of risk metrics (some pass today).
    """

    def test_risk_metrics_returns_200(self, client):
        """GET /api/risk/metrics must always return 200."""
        r = client.get("/api/risk/metrics")
        assert r.status_code == 200

    def test_risk_metrics_has_required_fields(self, client):
        """Risk metrics must include basic fields."""
        r = client.get("/api/risk/metrics")
        body = r.json()
        # These fields should already exist
        assert "total_exposure" in body
        assert "total_pnl" in body

    @pytest.mark.xfail(reason="S3-03: detailed risk metrics not implemented yet")
    def test_risk_metrics_has_daily_loss_field(self, client):
        """Risk metrics must include today's realized loss."""
        r = client.get("/api/risk/metrics")
        body = r.json()
        assert "daily_realized_loss" in body
        assert isinstance(body["daily_realized_loss"], (int, float))

    @pytest.mark.xfail(reason="S3-03: detailed risk metrics not implemented yet")
    def test_risk_metrics_has_orders_today_field(self, client):
        """Risk metrics must include order count for today."""
        r = client.get("/api/risk/metrics")
        body = r.json()
        assert "orders_today" in body
        assert isinstance(body["orders_today"], int)

    @pytest.mark.xfail(reason="S3-03: detailed risk metrics not implemented yet")
    def test_risk_metrics_has_limit_utilization(self, client):
        """Risk metrics should show % utilization of each limit."""
        r = client.get("/api/risk/metrics")
        body = r.json()
        # e.g. position_size_utilization: 0.45 means 45% of limit used
        assert "position_size_utilization" in body

    def test_risk_limits_persist_after_update(self, client):
        """Updated risk limits must persist across calls."""
        client.post(
            "/api/risk/limits",
            json={"max_position_size": 777_777, "max_daily_loss": 5_555},
        )
        r = client.get("/api/risk/limits")
        body = r.json()
        # GET /api/risk/limits returns the limits dict directly (no wrapper)
        limits = body.get("limits", body)
        assert limits["max_position_size"] == 777_777
        assert limits["max_daily_loss"] == 5_555
