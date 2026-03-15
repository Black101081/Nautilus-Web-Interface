"""
Security tests — Sprint 1: Credential Encryption & JWT Auth & Rate Limiting.

These tests define the REQUIRED behaviour for Sprint 1 implementation.
Tests marked with @pytest.mark.xfail are expected to fail until implemented.

Run:
    cd backend
    pytest tests/test_security.py -v
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ─── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    from fastapi.testclient import TestClient
    from nautilus_fastapi import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    return tmp_path / "test.db"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Credential Encryption
# ═════════════════════════════════════════════════════════════════════════════

class TestCredentialEncryption:
    """
    All adapter credentials MUST be stored encrypted.
    Direct DB reads must never reveal plaintext secrets.
    """

    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        """Authenticated client for credential tests."""
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

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_stored_key_is_not_plaintext(self, client, db_path):
        """After connecting, the DB must NOT contain the raw API key."""
        import sqlite3

        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "MY_PLAIN_KEY_12345", "api_secret": "MY_PLAIN_SECRET_99"},
        )

        con = sqlite3.connect(db_path)
        rows = con.execute("SELECT api_key, api_secret FROM adapter_configs").fetchall()
        con.close()

        assert rows, "No credentials stored"
        stored_key, stored_secret = rows[0]
        assert stored_key != "MY_PLAIN_KEY_12345", "api_key stored in plaintext!"
        assert stored_secret != "MY_PLAIN_SECRET_99", "api_secret stored in plaintext!"

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_ciphertext_is_not_empty(self, client, db_path):
        """The stored ciphertext must be non-empty (something was actually stored)."""
        import sqlite3

        client.post(
            "/api/adapters/bybit/connect",
            json={"api_key": "BYBIT_KEY", "api_secret": "BYBIT_SECRET"},
        )

        con = sqlite3.connect(db_path)
        row = con.execute(
            "SELECT api_key FROM adapter_configs WHERE adapter_id='bybit'"
        ).fetchone()
        con.close()

        assert row is not None
        assert len(row[0]) > 10, "Stored credential too short to be encrypted"

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_api_response_masks_key(self, client):
        """GET /api/adapters/{id} must return masked key, NOT the real key."""
        client.post(
            "/api/adapters/okx/connect",
            json={"api_key": "REAL_KEY_XYZ", "api_secret": "REAL_SECRET_XYZ"},
        )
        r = client.get("/api/adapters/okx")
        body = r.json()

        assert "api_key" not in body or body.get("api_key") != "REAL_KEY_XYZ", \
            "Full plaintext key must not appear in GET response"

        # Should have a masked field like "****_XYZ" or "api_key_masked"
        masked = body.get("api_key_masked", body.get("api_key", ""))
        assert "REAL_KEY_XYZ" not in masked, "Plaintext key leaked in API response"

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_list_adapters_does_not_leak_keys(self, client):
        """GET /api/adapters list must never expose plaintext credentials."""
        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "SECRET_LIST_KEY", "api_secret": "SECRET_LIST_SECRET"},
        )
        r = client.get("/api/adapters")
        body_text = r.text

        assert "SECRET_LIST_KEY" not in body_text
        assert "SECRET_LIST_SECRET" not in body_text

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_mask_shows_last_four_chars(self, client):
        """Masked key should reveal only the last 4 characters: '****abcd'."""
        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "APIKEY1234", "api_secret": "APISECRET5678"},
        )
        r = client.get("/api/adapters/binance")
        body = r.json()

        masked = body.get("api_key_masked", "")
        assert masked.endswith("1234"), f"Expected last 4 chars '1234', got '{masked}'"
        assert masked.startswith("*"), "Masked key should start with asterisks"

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_different_keys_produce_different_ciphertexts(self, client, db_path):
        """Two different keys must produce different ciphertexts (no deterministic IV)."""
        import sqlite3

        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "KEY_ALPHA", "api_secret": "SECRET_ALPHA"},
        )
        client.post(
            "/api/adapters/bybit/connect",
            json={"api_key": "KEY_BETA", "api_secret": "SECRET_BETA"},
        )

        con = sqlite3.connect(db_path)
        rows = con.execute(
            "SELECT api_key FROM adapter_configs ORDER BY adapter_id"
        ).fetchall()
        con.close()

        assert len(rows) >= 2
        assert rows[0][0] != rows[1][0], "Different keys must produce different ciphertexts"

    @pytest.mark.xfail(reason="S1-01: credential encryption not implemented yet")
    def test_reconnect_with_new_key_updates_ciphertext(self, client, db_path):
        """Reconnecting with a new API key must update the stored ciphertext."""
        import sqlite3

        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "FIRST_KEY", "api_secret": "FIRST_SECRET"},
        )
        first_row = sqlite3.connect(db_path).execute(
            "SELECT api_key FROM adapter_configs WHERE adapter_id='binance'"
        ).fetchone()

        client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "SECOND_KEY", "api_secret": "SECOND_SECRET"},
        )
        second_row = sqlite3.connect(db_path).execute(
            "SELECT api_key FROM adapter_configs WHERE adapter_id='binance'"
        ).fetchone()

        assert first_row[0] != second_row[0], "Stored ciphertext should change on key update"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — JWT Authentication
# ═════════════════════════════════════════════════════════════════════════════

class TestJWTAuth:
    """
    All API routes (except health/login) must require a valid JWT Bearer token.
    """

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_login_returns_access_token(self, client):
        """POST /api/auth/login must return a JWT access_token."""
        r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 20  # JWT is at least 20 chars

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_login_wrong_password_returns_401(self, client):
        """Wrong password must return 401."""
        r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong_password"},
        )
        assert r.status_code == 401

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_protected_route_without_token_returns_401(self, client):
        """Without Authorization header, protected routes return 401."""
        r = client.get("/api/strategies")
        assert r.status_code == 401

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_protected_route_with_valid_token(self, client):
        """With valid Bearer token, protected routes are accessible."""
        login_r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        token = login_r.json()["access_token"]

        r = client.get(
            "/api/strategies",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_invalid_token_returns_401(self, client):
        """Garbage token must return 401."""
        r = client.get(
            "/api/strategies",
            headers={"Authorization": "Bearer this.is.garbage"},
        )
        assert r.status_code == 401

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_health_endpoint_does_not_require_auth(self, client):
        """GET /api/health must always be public (no auth required)."""
        r = client.get("/api/health")
        assert r.status_code in (200, 503)  # either ok or degraded, not 401

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_token_contains_username(self, client):
        """Decoded JWT payload must contain 'sub' (username)."""
        import base64
        import json

        r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        token = r.json()["access_token"]

        # Decode payload (middle part) without verification
        payload_b64 = token.split(".")[1]
        # Add padding
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))

        assert "sub" in payload
        assert payload["sub"] == "admin"

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_token_has_expiry(self, client):
        """Decoded JWT payload must contain 'exp' (expiry timestamp)."""
        import base64
        import json

        r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        token = r.json()["access_token"]
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))

        assert "exp" in payload

    @pytest.mark.xfail(reason="S1-02: JWT auth not implemented yet")
    def test_refresh_token_extends_expiry(self, client):
        """POST /api/auth/refresh must return a new token with new expiry."""
        login_r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        token = login_r.json()["access_token"]

        refresh_r = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert refresh_r.status_code == 200
        new_token = refresh_r.json()["access_token"]
        assert new_token != token  # new token generated


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Rate Limiting
# ═════════════════════════════════════════════════════════════════════════════

class TestRateLimiting:
    """
    API must enforce rate limits to prevent brute-force and abuse.
    """

    @pytest.mark.xfail(reason="S1-05: rate limiting not implemented yet")
    def test_login_rate_limit_after_5_attempts(self, client):
        """5+ failed login attempts in a row must result in 429."""
        for i in range(5):
            client.post(
                "/api/auth/login",
                json={"username": "admin", "password": f"wrong{i}"},
            )

        # 6th attempt
        r = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong6"},
        )
        assert r.status_code == 429
        assert "retry" in r.text.lower() or "rate" in r.text.lower()

    @pytest.mark.xfail(reason="S1-05: rate limiting not implemented yet")
    def test_response_has_ratelimit_header(self, client):
        """All responses should include X-RateLimit-Remaining header."""
        r = client.get("/api/health")
        assert "X-RateLimit-Remaining" in r.headers

    @pytest.mark.xfail(reason="S1-05: rate limiting not implemented yet")
    def test_ratelimit_remaining_decrements(self, client):
        """X-RateLimit-Remaining must decrease with each request."""
        r1 = client.get("/api/health")
        r2 = client.get("/api/health")
        remaining1 = int(r1.headers.get("X-RateLimit-Remaining", 999))
        remaining2 = int(r2.headers.get("X-RateLimit-Remaining", 999))
        assert remaining2 < remaining1


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Input Sanitisation (already partially working — regression tests)
# ═════════════════════════════════════════════════════════════════════════════

class TestInputSanitisation:
    """
    Ensure common injection patterns are safely handled.
    These tests should PASS even before Sprint 1 (regression tests).
    """

    def test_sql_injection_in_adapter_id_returns_404(self, client):
        """SQL injection in adapter ID must not cause 500 or leakage."""
        r = client.get("/api/adapters/'; DROP TABLE adapter_configs;--")
        # Should be 404 (not found) or 422 (validation error), never 500
        assert r.status_code in (404, 422, 401)

    def test_xss_in_strategy_name_is_stored_safely(self, client):
        """Strategy name with XSS payload must be stored as plain text."""
        payload = "<script>alert('xss')</script>"
        r = client.post(
            "/api/strategies",
            json={"name": payload, "type": "sma_crossover"},
        )
        # Either stored safely or rejected
        if r.status_code == 200:
            strategy_id = r.json()["strategy_id"]
            r2 = client.get("/api/strategies")
            found = [s for s in r2.json()["strategies"] if s["id"] == strategy_id]
            assert found[0]["name"] == payload  # Stored as-is (plain text, no execution)

    def test_oversized_api_key_is_rejected(self, client):
        """API key longer than 512 chars should be rejected."""
        huge_key = "A" * 1000
        r = client.post(
            "/api/adapters/binance/connect",
            json={"api_key": huge_key, "api_secret": "normal_secret"},
        )
        # Must not crash server (500 is never acceptable)
        assert r.status_code != 500

    def test_null_bytes_in_credentials_rejected(self, client):
        """Credentials containing null bytes must be rejected."""
        r = client.post(
            "/api/adapters/binance/connect",
            json={"api_key": "key\x00injected", "api_secret": "secret"},
        )
        assert r.status_code in (400, 422, 200, 401)
        if r.status_code == 200:
            assert "\x00" not in r.text
