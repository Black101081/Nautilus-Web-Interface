"""Tests for /api/orders endpoints."""


def test_list_orders(client):
    response = client.get("/api/orders")
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert isinstance(data["orders"], list)


def test_create_order(client):
    payload = {
        "instrument": "BTCUSDT",
        "side": "BUY",
        "type": "LIMIT",
        "quantity": 0.01,
        "price": 60000.0,
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    order = data["order"]
    assert order["instrument"] == "BTCUSDT"
    assert order["side"] == "BUY"
    assert order["status"] == "PENDING"
    return order["id"]


def test_create_and_cancel_order(client):
    payload = {
        "instrument": "ETHUSDT",
        "side": "SELL",
        "type": "MARKET",
        "quantity": 1.0,
    }
    create_resp = client.post("/api/orders", json=payload)
    assert create_resp.status_code == 200
    order_id = create_resp.json()["order"]["id"]

    cancel_resp = client.delete(f"/api/orders/{order_id}")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["success"] is True


def test_cancel_nonexistent_order(client):
    response = client.delete("/api/orders/NONEXISTENT-ORDER-ID")
    assert response.status_code == 404


def test_orders_persist_across_requests(client):
    """Orders created in one request should appear in subsequent list requests."""
    payload = {
        "instrument": "SOLUSDT",
        "side": "BUY",
        "type": "LIMIT",
        "quantity": 5.0,
        "price": 150.0,
    }
    create_resp = client.post("/api/orders", json=payload)
    assert create_resp.status_code == 200
    order_id = create_resp.json()["order"]["id"]

    list_resp = client.get("/api/orders")
    assert list_resp.status_code == 200
    ids = [o["id"] for o in list_resp.json()["orders"]]
    assert order_id in ids
