"""Tests for the /api/health endpoint."""


def test_health_returns_200(client):
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_response_shape(client):
    data = client.get("/api/health").json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["version"] == "2.0.0"


def test_legacy_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_root_returns_200(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
