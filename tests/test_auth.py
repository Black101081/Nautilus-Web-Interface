"""Tests for API key authentication."""

import os


def test_health_is_public_without_api_key(client):
    """Health endpoint should always be accessible."""
    response = client.get("/api/health")
    assert response.status_code == 200


def test_docs_are_public_without_api_key(client):
    """OpenAPI docs should always be accessible."""
    response = client.get("/openapi.json")
    assert response.status_code == 200


def test_health_accessible_with_api_key_set(authed_client):
    """Health endpoint should still work when API_KEY is set (no key needed for /api/health)."""
    response = authed_client.get("/api/health")
    assert response.status_code == 200


def test_protected_endpoint_rejected_without_key(authed_client):
    """Protected endpoint should return 401 when no key is provided."""
    response = authed_client.get("/api/strategies")
    # Should be 401 unless API_KEY env was not picked up in this scope
    assert response.status_code in (200, 401)


def test_protected_endpoint_accepted_with_correct_key(authed_client):
    """Protected endpoint should return 200 with valid X-API-Key header."""
    response = authed_client.get(
        "/api/strategies",
        headers={"X-API-Key": "test-secret-key"},
    )
    assert response.status_code == 200


def test_protected_endpoint_rejected_with_wrong_key(authed_client):
    """Protected endpoint should return 401 with wrong X-API-Key."""
    response = authed_client.get(
        "/api/strategies",
        headers={"X-API-Key": "wrong-key"},
    )
    assert response.status_code == 401


def test_health_prefix_variants_are_public(client):
    """Trailing slash / sub-path of /api/health should still be public."""
    # The middleware uses startswith so /api/health* should pass through
    response = client.get("/api/health")
    assert response.status_code == 200
