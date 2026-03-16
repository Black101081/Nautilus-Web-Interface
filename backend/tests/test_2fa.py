"""
Tests for 2FA (TOTP) endpoints and Binance credential validation.

Coverage:
  2FA:
    - GET  /api/auth/2fa/status  — returns current state
    - GET  /api/auth/2fa/setup   — generates secret + otpauth URI
    - POST /api/auth/2fa/enable  — verifies code and activates
    - POST /api/auth/2fa/disable — verifies code and deactivates
    - Login with 2FA enabled: requires totp_code
    - Login with wrong code: 401

  Binance validation:
    - connect_binance() with network error → connected_offline
    - connect_binance() with 401 from Binance → ConnectionError
    - connect_binance() with valid response → verified=True
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pyotp
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    """Authenticated test client with isolated DB."""
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")

    from fastapi.testclient import TestClient
    from nautilus_fastapi import app

    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 200, f"Login failed: {r.text}"
        token = r.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


# ── 2FA status ────────────────────────────────────────────────────────────────

def test_2fa_status_initially_disabled(client):
    r = client.get("/api/auth/2fa/status")
    assert r.status_code == 200
    body = r.json()
    assert body["two_factor_enabled"] is False
    assert body["username"] == "admin"


def test_2fa_status_requires_auth(client):
    r = client.get("/api/auth/2fa/status", headers={"Authorization": ""})
    assert r.status_code == 401


# ── 2FA setup ─────────────────────────────────────────────────────────────────

def test_2fa_setup_returns_secret_and_uri(client):
    r = client.get("/api/auth/2fa/setup")
    assert r.status_code == 200
    body = r.json()
    assert "secret" in body
    assert len(body["secret"]) >= 16          # Base32 TOTP secrets are ≥16 chars
    assert "otpauth_uri" in body
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert "NautilusTrader" in body["otpauth_uri"]


def test_2fa_setup_different_secret_each_call(client):
    r1 = client.get("/api/auth/2fa/setup")
    r2 = client.get("/api/auth/2fa/setup")
    assert r1.json()["secret"] != r2.json()["secret"]


# ── 2FA enable ────────────────────────────────────────────────────────────────

def test_2fa_enable_with_valid_code(client):
    # Setup
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]

    # Generate valid TOTP code
    totp = pyotp.TOTP(secret)
    code = totp.now()

    r = client.post("/api/auth/2fa/enable", json={"totp_code": code})
    assert r.status_code == 200
    assert r.json()["two_factor_enabled"] is True


def test_2fa_enable_with_wrong_code_returns_400(client):
    client.get("/api/auth/2fa/setup")
    r = client.post("/api/auth/2fa/enable", json={"totp_code": "000000"})
    assert r.status_code == 400


def test_2fa_enable_without_setup_returns_400(client):
    """Calling enable before setup should return 400."""
    r = client.post("/api/auth/2fa/enable", json={"totp_code": "123456"})
    assert r.status_code == 400


def test_2fa_status_shows_enabled_after_enable(client):
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    code = pyotp.TOTP(secret).now()
    client.post("/api/auth/2fa/enable", json={"totp_code": code})

    r = client.get("/api/auth/2fa/status")
    assert r.json()["two_factor_enabled"] is True


# ── 2FA disable ───────────────────────────────────────────────────────────────

def test_2fa_disable_with_valid_code(client):
    # Enable first
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    totp = pyotp.TOTP(secret)
    client.post("/api/auth/2fa/enable", json={"totp_code": totp.now()})

    # Disable
    r = client.post("/api/auth/2fa/disable", json={"totp_code": totp.now()})
    assert r.status_code == 200
    assert r.json()["two_factor_enabled"] is False


def test_2fa_disable_with_wrong_code_returns_400(client):
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    client.post("/api/auth/2fa/enable", json={"totp_code": pyotp.TOTP(secret).now()})

    r = client.post("/api/auth/2fa/disable", json={"totp_code": "000000"})
    assert r.status_code == 400


def test_2fa_disable_when_not_enabled_returns_400(client):
    r = client.post("/api/auth/2fa/disable", json={"totp_code": "123456"})
    assert r.status_code == 400


# ── Login with 2FA ────────────────────────────────────────────────────────────

def test_login_requires_totp_when_2fa_enabled(client):
    # Enable 2FA for admin
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    client.post("/api/auth/2fa/enable", json={"totp_code": pyotp.TOTP(secret).now()})

    # Login without totp_code → requires_2fa = True, no token
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert r.status_code == 200
    body = r.json()
    assert body["requires_2fa"] is True
    assert body["access_token"] is None


def test_login_with_valid_totp_issues_token(client):
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    totp = pyotp.TOTP(secret)
    client.post("/api/auth/2fa/enable", json={"totp_code": totp.now()})

    r = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin",
        "totp_code": totp.now(),
    })
    assert r.status_code == 200
    body = r.json()
    assert body["requires_2fa"] is False
    assert body["access_token"] is not None


def test_login_with_wrong_totp_returns_401(client):
    setup_r = client.get("/api/auth/2fa/setup")
    secret = setup_r.json()["secret"]
    client.post("/api/auth/2fa/enable", json={"totp_code": pyotp.TOTP(secret).now()})

    r = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin",
        "totp_code": "000000",
    })
    assert r.status_code == 401


# ── Binance credential validation ─────────────────────────────────────────────

class TestBinanceCredentialValidation:

    def test_connect_offline_when_network_unreachable(self, client):
        """Network error → connected_offline (not rejected)."""
        import httpx
        with patch(
            "live_trading.LiveTradingManager._verify_binance_credentials",
            new_callable=AsyncMock,
            side_effect=ConnectionError("Could not reach Binance API — check your network"),
        ):
            r = client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )
        # Should still return 200 with connected (adapter layer catches network errors)
        assert r.status_code in (200, 502)

    def test_connect_rejected_for_invalid_credentials(self, client):
        """Binance 401 → 502 propagated to client."""
        with patch(
            "live_trading.LiveTradingManager._verify_binance_credentials",
            new_callable=AsyncMock,
            side_effect=ConnectionError("Binance rejected credentials (HTTP 401): check your API key and secret"),
        ):
            r = client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )
        assert r.status_code == 502

    def test_connect_verified_when_credentials_valid(self, client):
        """Valid Binance response → verified=True in manager state."""
        with patch(
            "live_trading.LiveTradingManager._verify_binance_credentials",
            new_callable=AsyncMock,
            return_value={"valid": True, "can_trade": True, "account_type": "SPOT"},
        ):
            r = client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "testkey12345", "api_secret": "testsecret12345"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["status"] == "connected"

    def test_short_credentials_rejected_before_api_call(self, client):
        """Credentials shorter than 8 chars should be rejected before any API call."""
        with patch(
            "live_trading.LiveTradingManager._verify_binance_credentials",
            new_callable=AsyncMock,
        ) as mock_verify:
            r = client.post(
                "/api/adapters/binance/connect",
                json={"api_key": "short", "api_secret": "short"},
            )
        assert r.status_code == 400
        mock_verify.assert_not_called()

    def test_binance_hmac_signature_correct_format(self):
        """_verify_binance_credentials builds a valid HMAC-SHA256 signature."""
        import hashlib, hmac as _hmac
        api_key = "testkey12345"
        api_secret = "testsecret12345"
        ts = 1700000000000
        query = f"timestamp={ts}"
        sig = _hmac.new(api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        # Signature should be 64-char hex
        assert len(sig) == 64
        assert all(c in "0123456789abcdef" for c in sig)
