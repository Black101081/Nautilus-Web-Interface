"""Tests for /api/alerts endpoints with SQLite persistence."""

import pytest


def test_list_alerts_empty_initially(client):
    """GET /api/alerts should return an empty list on a fresh DB."""
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert isinstance(data["alerts"], list)


def test_create_alert(client):
    payload = {
        "symbol": "BTCUSDT",
        "condition": "above",
        "price": 100000.0,
        "message": "BTC hits 100k",
    }
    response = client.post("/api/alerts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    alert = data["alert"]
    assert alert["symbol"] == "BTCUSDT"
    assert alert["condition"] == "above"
    assert alert["price"] == 100000.0
    assert alert["status"] == "active"
    assert "id" in alert
    return alert["id"]


def test_alert_sqlite_persistence(client):
    """Alert created in one request should appear in a subsequent list."""
    payload = {
        "symbol": "ETHUSDT",
        "condition": "below",
        "price": 1000.0,
    }
    create_resp = client.post("/api/alerts", json=payload)
    assert create_resp.status_code == 200
    alert_id = create_resp.json()["alert"]["id"]

    list_resp = client.get("/api/alerts")
    ids = [a["id"] for a in list_resp.json()["alerts"]]
    assert alert_id in ids


def test_delete_alert(client):
    payload = {
        "symbol": "SOLUSDT",
        "condition": "above",
        "price": 200.0,
    }
    create_resp = client.post("/api/alerts", json=payload)
    alert_id = create_resp.json()["alert"]["id"]

    delete_resp = client.delete(f"/api/alerts/{alert_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["success"] is True

    list_resp = client.get("/api/alerts")
    ids = [a["id"] for a in list_resp.json()["alerts"]]
    assert alert_id not in ids


def test_delete_nonexistent_alert(client):
    response = client.delete("/api/alerts/ALERT-NONEXISTENT")
    assert response.status_code == 404
