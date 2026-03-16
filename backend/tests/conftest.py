"""
Shared pytest configuration.

Resets module-level rate-limit counters before each test so that the
/api/auth/login call inside every `client` fixture is never blocked by the
5-req/minute cap that accumulates across the test session.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


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
