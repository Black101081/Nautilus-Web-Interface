"""
Authentication router — Sprint 1 (S1-02).

Endpoints:
  POST /api/auth/login    — issue JWT access token
  POST /api/auth/refresh  — issue fresh token given valid existing token
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

import database
from auth_jwt import authenticate_user, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
_security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate with username/password and return a JWT access token."""
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Honour session_timeout from settings (minutes → timedelta); fall back to JWT_EXPIRE_HOURS
    settings = await database.get_settings()
    session_minutes = settings.get("security", {}).get("session_timeout", 0)
    expires = timedelta(minutes=int(session_minutes)) if session_minutes else None

    token = create_access_token({"sub": user["username"], "role": user["role"]}, expires_delta=expires)
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}


@router.post("/refresh")
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
):
    """Issue a new token (extending expiry) given a valid existing Bearer token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    new_token = create_access_token(
        {"sub": payload["sub"], "role": payload.get("role", "trader")}
    )
    return {"access_token": new_token, "token_type": "bearer"}
