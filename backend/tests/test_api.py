"""
Unit tests for the Nautilus Trader API.

Run with:
    cd backend
    pytest tests/ -v
"""

import sys
from pathlib import Path

import pytest

# Ensure the backend directory is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    """Create a test client with an isolated SQLite database."""
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")

    # FastAPI TestClient (sync wrapper around async app)
    from fastapi.testclient import TestClient
    from nautilus_fastapi import app

    with TestClient(app) as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["version"] == "2.0.0"


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "running"


def test_health_alias(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


# ── Engine ────────────────────────────────────────────────────────────────────

def test_engine_info(client):
    r = client.get("/api/engine/info")
    assert r.status_code == 200
    body = r.json()
    assert "trader_id" in body
    assert "is_initialized" in body


def test_system_metrics(client):
    r = client.get("/api/system/metrics")
    assert r.status_code == 200
    body = r.json()
    assert "uptime_seconds" in body
    assert "requests_total" in body


# ── Strategies ────────────────────────────────────────────────────────────────

def test_list_strategies_empty(client):
    r = client.get("/api/strategies")
    assert r.status_code == 200
    body = r.json()
    assert "strategies" in body
    assert isinstance(body["strategies"], list)


def test_create_and_list_strategy(client):
    r = client.post("/api/strategies", json={"name": "Test Strategy"})
    assert r.status_code == 200

    r = client.get("/api/strategies")
    assert r.status_code == 200
    strategies = r.json()["strategies"]
    names = [s["name"] for s in strategies]
    assert "Test Strategy" in names


def test_start_stop_nonexistent_strategy(client):
    r = client.post("/api/strategies/nonexistent/start")
    assert r.status_code == 404

    r = client.post("/api/strategies/nonexistent/stop")
    assert r.status_code == 404


# ── Orders ────────────────────────────────────────────────────────────────────

def test_list_orders(client):
    r = client.get("/api/orders")
    assert r.status_code == 200
    assert "orders" in r.json()


def test_create_order(client):
    payload = {
        "instrument": "EUR/USD.SIM",
        "side": "BUY",
        "type": "MARKET",
        "quantity": 10000,
    }
    r = client.post("/api/orders", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["order"]["instrument"] == "EUR/USD.SIM"
    assert body["order"]["status"] == "PENDING"
    return body["order"]["id"]


def test_create_order_invalid_side(client):
    r = client.post(
        "/api/orders",
        json={"instrument": "EUR/USD.SIM", "side": "INVALID", "quantity": 1000},
    )
    assert r.status_code == 422  # Pydantic validation error


def test_cancel_order(client):
    # Create first
    r = client.post(
        "/api/orders",
        json={"instrument": "EUR/USD.SIM", "side": "BUY", "quantity": 1000},
    )
    order_id = r.json()["order"]["id"]

    # Cancel it
    r = client.delete(f"/api/orders/{order_id}")
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_cancel_nonexistent_order(client):
    r = client.delete("/api/orders/ORD-DOESNOTEXIST")
    assert r.status_code == 404


# ── Alerts ────────────────────────────────────────────────────────────────────

def test_list_alerts_empty(client):
    r = client.get("/api/alerts")
    assert r.status_code == 200
    body = r.json()
    assert body["alerts"] == []
    assert body["count"] == 0


def test_create_alert(client):
    payload = {"symbol": "BTCUSDT", "condition": "above", "price": 70000}
    r = client.post("/api/alerts", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["alert"]["symbol"] == "BTCUSDT"
    assert body["alert"]["price"] == 70000


def test_create_alert_invalid_condition(client):
    r = client.post(
        "/api/alerts",
        json={"symbol": "BTCUSDT", "condition": "maybe", "price": 70000},
    )
    assert r.status_code == 422


def test_delete_alert(client):
    r = client.post(
        "/api/alerts",
        json={"symbol": "ETHUSDT", "condition": "below", "price": 3000},
    )
    alert_id = r.json()["alert"]["id"]

    r = client.delete(f"/api/alerts/{alert_id}")
    assert r.status_code == 200

    r = client.get("/api/alerts")
    ids = [a["id"] for a in r.json()["alerts"]]
    assert alert_id not in ids


def test_delete_nonexistent_alert(client):
    r = client.delete("/api/alerts/ALT-DOESNOTEXIST")
    assert r.status_code == 404


# ── Risk ──────────────────────────────────────────────────────────────────────

def test_get_risk_limits(client):
    r = client.get("/api/risk/limits")
    assert r.status_code == 200
    body = r.json()
    assert "max_position_size" in body
    assert "max_daily_loss" in body


def test_update_risk_limits(client):
    r = client.post("/api/risk/limits", json={"max_daily_loss": 9999})
    assert r.status_code == 200
    body = r.json()
    assert body["limits"]["max_daily_loss"] == 9999


def test_risk_metrics(client):
    r = client.get("/api/risk/metrics")
    assert r.status_code == 200
    body = r.json()
    assert "max_drawdown" in body
    assert "total_pnl" in body


# ── Market Data ───────────────────────────────────────────────────────────────

def test_market_data_instruments(client):
    r = client.get("/api/market-data/instruments")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] > 0
    syms = [i["symbol"] for i in body["instruments"]]
    assert "BTCUSDT" in syms


def test_market_data_quote(client):
    r = client.get("/api/market-data/BTCUSDT")
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "BTCUSDT"
    assert body["price"] > 0
    assert body["bid"] < body["ask"]


def test_market_data_unknown_symbol(client):
    r = client.get("/api/market-data/FAKECOIN")
    assert r.status_code == 404


# ── Settings ──────────────────────────────────────────────────────────────────

def test_get_settings(client):
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert "general" in body
    assert "notifications" in body


def test_save_settings(client):
    r = client.post(
        "/api/settings",
        json={"general": {"system_name": "Test System"}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["settings"]["general"]["system_name"] == "Test System"


# ── Adapters ──────────────────────────────────────────────────────────────────

def test_list_adapters(client):
    r = client.get("/api/adapters")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] > 0
    ids = [a["id"] for a in body["adapters"]]
    assert "binance" in ids
    assert "interactive_brokers" in ids


# ── Components ────────────────────────────────────────────────────────────────

def test_list_components(client):
    r = client.get("/api/components")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 6
    comp_ids = [c["id"] for c in body["components"]]
    assert "risk_engine" in comp_ids


def test_component_actions(client):
    for action in ("start", "stop", "restart", "configure"):
        r = client.post(f"/api/component/{action}", json={"component": "risk_engine"})
        assert r.status_code == 200
        assert r.json()["success"] is True


# ── Database ops ──────────────────────────────────────────────────────────────

def test_database_backup(client):
    r = client.post("/api/database/backup", json={"db_type": "postgresql"})
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_database_optimize(client):
    r = client.post("/api/database/optimize", json={"db_type": "parquet"})
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_database_clean(client):
    r = client.post("/api/database/clean", json={"cache_type": "redis"})
    assert r.status_code == 200
    assert r.json()["success"] is True


# ── Auth middleware ───────────────────────────────────────────────────────────

def test_auth_disabled_by_default(client):
    """Without API_KEY set, all requests should pass through."""
    r = client.get("/api/strategies")
    assert r.status_code == 200


@pytest.fixture
def authed_client(monkeypatch, tmp_path):
    """TestClient with API_KEY='test-secret' enabled."""
    import auth
    import database

    monkeypatch.setattr(auth, "API_KEY", "test-secret")
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")

    from fastapi.testclient import TestClient
    from nautilus_fastapi import app

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_auth_enabled_blocks_without_key(authed_client):
    """With API_KEY set, requests without the header should get 401."""
    r = authed_client.get("/api/strategies")
    assert r.status_code == 401


def test_auth_enabled_passes_with_key(authed_client):
    """With API_KEY set and correct header, requests should pass through."""
    r = authed_client.get("/api/strategies", headers={"X-API-Key": "test-secret"})
    assert r.status_code == 200
