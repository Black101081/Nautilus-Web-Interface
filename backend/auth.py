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

# Exact-match paths (O(1) set lookup)
_PUBLIC_EXACT: frozenset[str] = frozenset({"/", "/health", "/api/health"})
# Prefix paths — docs, openapi, etc. (checked sequentially, short list)
_PUBLIC_PREFIXES: tuple[str, ...] = ("/docs", "/redoc", "/openapi.json")


def _is_public(path: str) -> bool:
    """Return True if the request path should bypass API key auth."""
    if path in _PUBLIC_EXACT:
        return True
    return any(path.startswith(p) for p in _PUBLIC_PREFIXES)


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
