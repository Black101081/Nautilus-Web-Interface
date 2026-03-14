"""
Simple API Key authentication middleware for Nautilus Trader API
Set the API_KEY environment variable to enable authentication.
If API_KEY is not set, authentication is disabled (development mode).
"""

import os
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

API_KEY = os.getenv("API_KEY", "")

# Paths that are always public (no auth required)
PUBLIC_PATHS = {"/api/health", "/ws", "/docs", "/openapi.json", "/redoc"}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Middleware that validates X-API-Key header when API_KEY env var is set."""

    async def dispatch(self, request: Request, call_next):
        # Auth disabled if API_KEY not configured
        if not API_KEY:
            return await call_next(request)

        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Skip OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        key = request.headers.get("X-API-Key", "")
        if key != API_KEY:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"}
            )

        return await call_next(request)
