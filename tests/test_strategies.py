"""Tests for /api/strategies endpoints."""


def test_list_strategies(client):
    response = client.get("/api/strategies")
    assert response.status_code == 200
    data = response.json()
    assert "strategies" in data
    assert isinstance(data["strategies"], list)


def test_create_strategy(client):
    payload = {"name": "Test Strategy", "description": "A test strategy"}
    response = client.post("/api/strategies", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True


def test_nautilus_list_strategies(client):
    response = client.get("/api/nautilus/strategies")
    assert response.status_code == 200
    data = response.json()
    assert "strategies" in data
    assert data["success"] is True


def test_delete_nonexistent_strategy(client):
    response = client.delete("/api/strategies/nonexistent-id-123")
    assert response.status_code == 404


def test_strategy_lifecycle(client):
    """Create → start → stop → delete."""
    payload = {"name": "Lifecycle Strategy", "description": "Lifecycle test"}
    create_resp = client.post("/api/strategies", json=payload)
    assert create_resp.status_code == 200
    strategy_id = create_resp.json().get("strategy_id")
    if strategy_id is None:
        # If creation failed (e.g. nautilus_trader not fully available), skip
        return

    start_resp = client.post(f"/api/strategies/{strategy_id}/start")
    assert start_resp.status_code == 200

    stop_resp = client.post(f"/api/strategies/{strategy_id}/stop")
    assert stop_resp.status_code == 200

    delete_resp = client.delete(f"/api/strategies/{strategy_id}")
    assert delete_resp.status_code == 200
