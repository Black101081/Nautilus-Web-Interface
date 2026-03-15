"""
API Key authentication middleware for Nautilus Trader API.
Set the API_KEY environment variable to enable authentication.
If API_KEY is not set, authentication is disabled (development mode).
"""

import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

API_KEY = os.getenv("API_KEY", "")

# Paths that are always public — checked by prefix so /docs, /docs/oauth2-redirect, etc. all pass
PUBLIC_PREFIXES = ("/docs", "/redoc", "/openapi.json", "/health", "/api/health", "/")


def _is_public(path: str) -> bool:
    """Return True if the request path should bypass API key auth."""
    # Exact root match
    if path == "/":
        return True
    for prefix in PUBLIC_PREFIXES:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
            return True
    return False


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validates X-API-Key header when API_KEY env var is set."""

    async def dispatch(self, request: Request, call_next):
        # Auth disabled when API_KEY is not configured
        if not API_KEY:
            return await call_next(request)

        # Always allow public paths and CORS preflight
        if request.method == "OPTIONS" or _is_public(request.url.path):
            return await call_next(request)

        key = request.headers.get("X-API-Key", "")
        if key != API_KEY:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
