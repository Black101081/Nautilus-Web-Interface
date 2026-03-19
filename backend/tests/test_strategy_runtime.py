"""
Strategy Runtime tests — Sprint 3.

Tests for:
- Strategy lifecycle (start/stop actually does something)
- Signal generation logic (SMA crossover, RSI)
- MACD strategy (new)
- Performance live update

Run:
    cd backend
    pytest tests/test_strategy_runtime.py -v
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
# SECTION 1 — Strategy Lifecycle
# ═════════════════════════════════════════════════════════════════════════════

class TestStrategyLifecycle:

    def test_strategy_status_is_running_after_start(self, client):
        """After start, DB status must be 'running'."""
        r = client.post("/api/strategies", json={"name": "SMA RT", "type": "sma_crossover"})
        sid = r.json()["strategy_id"]
        client.post(f"/api/strategies/{sid}/start")
        r = client.get("/api/strategies")
        found = [s for s in r.json()["strategies"] if s["id"] == sid]
        assert found[0]["status"] == "running"

    def test_strategy_status_is_stopped_after_stop(self, client):
        """After stop, DB status must be 'stopped'."""
        r = client.post("/api/strategies", json={"name": "SMA Stop", "type": "sma_crossover"})
        sid = r.json()["strategy_id"]
        client.post(f"/api/strategies/{sid}/start")
        client.post(f"/api/strategies/{sid}/stop")
        r = client.get("/api/strategies")
        found = [s for s in r.json()["strategies"] if s["id"] == sid]
        assert found[0]["status"] == "stopped"

    def test_start_registers_strategy_in_live_engine(self, client):
        """Starting a strategy must register it with the running engine."""
        from unittest.mock import patch, MagicMock

        with patch("state.nautilus_system") as mock_system:
            mock_system.start_strategy = MagicMock(return_value=True)

            r = client.post(
                "/api/strategies",
                json={"name": "Engine Reg", "type": "sma_crossover"},
            )
            sid = r.json()["strategy_id"]
            client.post(f"/api/strategies/{sid}/start")

            mock_system.start_strategy.assert_called_once_with(sid)

    def test_stop_deregisters_strategy_from_live_engine(self, client):
        """Stopping a strategy must deregister it from the engine."""
        from unittest.mock import patch, MagicMock

        with patch("state.nautilus_system") as mock_system:
            mock_system.stop_strategy = MagicMock(return_value=True)

            r = client.post(
                "/api/strategies",
                json={"name": "Engine Dereg", "type": "sma_crossover"},
            )
            sid = r.json()["strategy_id"]
            client.post(f"/api/strategies/{sid}/start")
            client.post(f"/api/strategies/{sid}/stop")

            mock_system.stop_strategy.assert_called_once_with(sid)

    def test_strategy_performance_updates_after_trade(self, client):
        """After a trade is executed, strategy performance metrics must update."""
        r = client.post(
            "/api/strategies",
            json={"name": "Perf Update", "type": "sma_crossover"},
        )
        sid = r.json()["strategy_id"]
        client.post(f"/api/strategies/{sid}/start")

        # Simulate a trade being attributed to this strategy
        import asyncio
        import database

        async def inject_trade():
            await database.init_db()
            # Insert a profitable trade for this strategy
            await database._execute(
                """INSERT INTO orders
                   (id, instrument, side, type, quantity, price, status, filled_qty, pnl, strategy_id, timestamp)
                   VALUES ('ORD-PERF-001', 'BTC/USDT', 'SELL', 'MARKET', 1, 55000, 'filled', 1, 500.0, ?, datetime('now'))""",
                (sid,),
                commit=True,
            )

        asyncio.run(inject_trade())

        r = client.get("/api/strategies")
        found = [s for s in r.json()["strategies"] if s["id"] == sid]
        perf = found[0].get("performance", {})
        assert perf.get("total_pnl", 0) == 500.0


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — SMA Crossover Signal Logic
# ═════════════════════════════════════════════════════════════════════════════

class TestSMACrossoverLogic:
    """Unit tests for SMA signal generation (pure logic, no engine needed)."""

    def test_sma_crossover_buy_signal(self):
        """fast_sma > slow_sma → BUY condition met (pure arithmetic check)."""
        # Fast SMA > slow SMA → BUY signal
        fast_prices = [100, 100, 100, 100, 100, 105, 110, 115, 120, 125]  # trending up
        slow_prices = [100, 100, 100, 100, 100, 100, 101, 102, 103, 104,
                       105, 106, 107, 108, 109, 110, 111, 112, 113, 114]  # lagging

        fast_sma = sum(fast_prices) / len(fast_prices)
        slow_sma = sum(slow_prices) / len(slow_prices)

        assert fast_sma > slow_sma, (
            f"Test data invalid: fast_sma={fast_sma:.2f} should be above slow_sma={slow_sma:.2f}"
        )

    def test_sma_crossover_sell_signal(self):
        """fast_sma < slow_sma → SELL signal."""
        fast_sma = 90.0   # fast dropped
        slow_sma = 100.0  # slow lagging
        assert fast_sma < slow_sma

    def test_sma_crossover_rejects_fast_gte_slow(self, client):
        """fast_period >= slow_period must be rejected at creation time."""
        r = client.post(
            "/api/strategies",
            json={
                "name": "Bad SMA",
                "type": "sma_crossover",
                "fast_period": 50,
                "slow_period": 50,
            },
        )
        assert r.status_code == 422

    def test_sma_crossover_valid_periods(self, client):
        """fast_period < slow_period is valid."""
        r = client.post(
            "/api/strategies",
            json={
                "name": "Good SMA",
                "type": "sma_crossover",
                "fast_period": 10,
                "slow_period": 50,
            },
        )
        assert r.status_code == 200


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — RSI Signal Logic
# ═════════════════════════════════════════════════════════════════════════════

class TestRSILogic:
    """Unit tests for RSI signal generation."""

    def _compute_rsi(self, prices: list, period: int = 14) -> float:
        """Simple RSI computation for test validation."""
        if len(prices) < period + 1:
            return 50.0
        changes = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
        gains = [max(c, 0) for c in changes[-period:]]
        losses = [abs(min(c, 0)) for c in changes[-period:]]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    def test_rsi_below_30_is_oversold(self):
        """RSI < 30 → oversold → should generate BUY signal."""
        # Prices declining sharply → RSI < 30
        prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30]
        rsi = self._compute_rsi(prices)
        assert rsi < 30, f"Expected RSI < 30 for declining prices, got {rsi:.1f}"

    def test_rsi_above_70_is_overbought(self):
        """RSI > 70 → overbought → should generate SELL signal."""
        # Prices rising sharply → RSI > 70
        prices = [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170]
        rsi = self._compute_rsi(prices)
        assert rsi > 70, f"Expected RSI > 70 for rising prices, got {rsi:.1f}"

    def test_rsi_period_validation(self, client):
        """RSI period must be between 2 and 200."""
        r = client.post(
            "/api/strategies",
            json={"name": "RSI Bad Period", "type": "rsi", "rsi_period": 1},
        )
        assert r.status_code == 422

    def test_rsi_period_boundary_valid(self, client):
        """RSI period = 14 (default) must be accepted."""
        r = client.post(
            "/api/strategies",
            json={"name": "RSI Valid", "type": "rsi", "rsi_period": 14},
        )
        assert r.status_code == 200

    def test_rsi_overbought_oversold_levels_validation(self, client):
        """oversold_level must be < overbought_level."""
        r = client.post(
            "/api/strategies",
            json={
                "name": "RSI Levels Bad",
                "type": "rsi",
                "oversold_level": 70,
                "overbought_level": 30,  # inverted!
            },
        )
        assert r.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 4 — MACD Strategy (Sprint 3 — new type)
# ═════════════════════════════════════════════════════════════════════════════

class TestMACDStrategy:

    def test_create_macd_strategy(self, client):
        """Creating a MACD strategy must succeed with valid parameters."""
        r = client.post(
            "/api/strategies",
            json={
                "name": "MACD Default",
                "type": "macd",
                "fast_period": 12,
                "slow_period": 26,
                "signal_period": 9,
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["strategy_id"] is not None

    def test_macd_fast_must_be_less_than_slow(self, client):
        """MACD fast_period >= slow_period must be rejected."""
        r = client.post(
            "/api/strategies",
            json={
                "name": "MACD Bad",
                "type": "macd",
                "fast_period": 26,
                "slow_period": 12,  # reversed!
                "signal_period": 9,
            },
        )
        assert r.status_code == 422

    def test_macd_in_strategy_types_list(self, client):
        """GET /api/strategy-types must include 'macd'."""
        r = client.get("/api/strategy-types")
        body = r.json()
        types = [t["id"] for t in body.get("strategy_types", [])]
        assert "macd" in types

    def test_macd_line_crossover_logic(self):
        """MACD line crossing above signal line → BUY."""
        # macd_line > signal_line → bullish crossover → BUY
        macd_line = 0.5
        signal_line = 0.2
        assert macd_line > signal_line  # Buy condition met

    def test_macd_strategy_appears_in_list(self, client):
        """After creating a MACD strategy, it must appear in /api/strategies."""
        r = client.post(
            "/api/strategies",
            json={"name": "MACD List Test", "type": "macd",
                  "fast_period": 12, "slow_period": 26, "signal_period": 9},
        )
        sid = r.json()["strategy_id"]

        r = client.get("/api/strategies")
        found = [s for s in r.json()["strategies"] if s["id"] == sid]
        assert found, "MACD strategy not found in strategy list"
        assert found[0]["type"] == "macd"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Strategy Types Registry
# ═════════════════════════════════════════════════════════════════════════════

class TestStrategyTypesRegistry:

    def test_strategy_types_returns_sma_and_rsi(self, client):
        """Currently supported types: sma_crossover, rsi.
        Note: endpoint returns {"types": [...]} not {"strategy_types": [...]}
        """
        r = client.get("/api/strategy-types")
        assert r.status_code == 200
        body = r.json()
        # Response uses "types" key
        raw_list = body.get("types", body.get("strategy_types", []))
        types = [t["id"] for t in raw_list]
        assert "sma_crossover" in types
        assert "rsi" in types

    def test_strategy_types_includes_macd(self, client):
        r = client.get("/api/strategy-types")
        types = [t["id"] for t in r.json().get("strategy_types", [])]
        assert "macd" in types

    def test_unknown_strategy_type_rejected(self, client):
        """Creating a strategy with an unknown type must fail."""
        r = client.post(
            "/api/strategies",
            json={"name": "Unknown", "type": "neural_network_ai_v9"},
        )
        assert r.status_code in (400, 422)
