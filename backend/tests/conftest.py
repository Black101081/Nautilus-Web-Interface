"""
Shared pytest configuration.

Resets module-level rate-limit counters before each test so that the
/api/auth/login call inside every `client` fixture is never blocked by the
5-req/minute cap that accumulates across the test session.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Disable the NautilusTrader TradingNode in tests — it makes C-level calls that
# abort the process when run outside a proper live environment.
os.environ.setdefault("NAUTILUS_DISABLE_LIVE_NODE", "1")


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Authenticated admin test client with isolated DB."""
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


@pytest.fixture(autouse=True)
def reset_rate_limit_counters():
    """Clear in-memory rate-limit state before every test."""
    try:
        import nautilus_fastapi
        nautilus_fastapi._login_counters.clear()
        nautilus_fastapi._global_counters.clear()
    except (ImportError, AttributeError):
        pass
    yield


@pytest.fixture(autouse=True)
def reset_live_manager():
    """Reset LiveTradingManager singleton state between tests to prevent leakage."""
    try:
        from state import live_manager
        live_manager._connections.clear()
        live_manager._is_active = False
    except (ImportError, AttributeError):
        pass
    yield
