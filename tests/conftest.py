"""
Shared pytest fixtures for Nautilus Trader API tests.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend is importable
BACKEND_DIR = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Point catalog path to a temp directory so tests don't need real data
os.environ.setdefault(
    "NAUTILUS_CATALOG_PATH",
    str(tempfile.mkdtemp(prefix="nautilus_test_")),
)


@pytest.fixture(scope="session")
def client():
    """Return a FastAPI TestClient with the app fully initialized."""
    # Import app after path is set up
    from nautilus_fastapi import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="session")
def authed_client():
    """TestClient with a fixed API key injected via header."""
    os.environ["API_KEY"] = "test-secret-key"
    # Reload auth module so it picks up the new value
    import importlib
    import auth
    importlib.reload(auth)

    from nautilus_fastapi import app  # noqa: PLC0415
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    del os.environ["API_KEY"]
