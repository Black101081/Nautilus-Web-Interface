"""
Authentication router — Sprint 1 (S1-02) + Sprint 4 2FA (TOTP).

Endpoints:
  POST /api/auth/login              — issue JWT (with optional TOTP support)
  POST /api/auth/refresh            — issue fresh token
  GET  /api/auth/2fa/setup          — generate new TOTP secret (auth required)
  POST /api/auth/2fa/enable         — verify code then activate 2FA
  POST /api/auth/2fa/disable        — verify code then deactivate 2FA
  GET  /api/auth/2fa/status         — return current 2FA state for caller
"""

from datetime import timedelta

import pyotp
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

import database
from auth_jwt import authenticate_user, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
_security = HTTPBearer(auto_error=False)


# ── Request / Response models ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str = ""  # Optional — required only when 2FA is enabled


class TotpVerifyRequest(BaseModel):
    totp_code: str = Field(..., min_length=6, max_length=8)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_user(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> dict:
    """Dependency: verify JWT and return payload."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def _verify_totp(secret: str, code: str) -> bool:
    """Return True if the TOTP code is valid (allows ±1 window for clock drift)."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest):
    """
    Authenticate and issue a JWT access token.

    If the user has 2FA enabled:
    - Without totp_code → returns {"requires_2fa": true} (HTTP 200, no token)
    - With totp_code    → verifies TOTP, then issues token (or 401 on failure)
    """
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ── 2FA check ─────────────────────────────────────────────────────────────
    twofa = await database.get_user_2fa(body.username)
    if twofa and twofa.get("two_factor_enabled"):
        if not body.totp_code:
            # Signal client that a TOTP code is required (no token issued yet)
            return {"requires_2fa": True, "access_token": None, "token_type": "bearer"}
        if not _verify_totp(twofa["totp_secret"], body.totp_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # ── Issue token ────────────────────────────────────────────────────────────
    settings = await database.get_settings()
    session_minutes = settings.get("security", {}).get("session_timeout", 0)
    expires = timedelta(minutes=int(session_minutes)) if session_minutes else None

    token = create_access_token({"sub": user["username"], "role": user["role"]}, expires_delta=expires)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "requires_2fa": False,
    }


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


# ── 2FA endpoints (require authenticated user) ────────────────────────────────

@router.get("/2fa/status")
async def get_2fa_status(payload: dict = Depends(_current_user)):
    """Return whether 2FA is currently enabled for the caller."""
    username = payload["sub"]
    twofa = await database.get_user_2fa(username)
    enabled = bool(twofa and twofa.get("two_factor_enabled"))
    return {"two_factor_enabled": enabled, "username": username}


@router.get("/2fa/setup")
async def setup_2fa(payload: dict = Depends(_current_user)):
    """
    Generate a new TOTP secret for the caller and store it (unactivated).

    Returns the Base32 secret and an otpauth URI suitable for QR code display.
    The caller must confirm with /2fa/enable before 2FA is actually enforced.
    """
    username = payload["sub"]
    secret = pyotp.random_base32()

    # Store unactivated secret
    await database.set_totp_secret(username, secret)

    # Build otpauth URI (compatible with Google Authenticator, Authy, etc.)
    totp = pyotp.TOTP(secret)
    otpauth_uri = totp.provisioning_uri(name=username, issuer_name="NautilusTrader")

    return {
        "secret": secret,
        "otpauth_uri": otpauth_uri,
        "instructions": (
            "1. Scan the QR code (or enter the secret) in your authenticator app. "
            "2. Call POST /api/auth/2fa/enable with the 6-digit code to activate."
        ),
    }


@router.post("/2fa/enable")
async def enable_2fa(body: TotpVerifyRequest, payload: dict = Depends(_current_user)):
    """
    Activate 2FA for the caller after verifying the TOTP code.

    Must be called after /2fa/setup once the user has added the secret to
    their authenticator app.
    """
    username = payload["sub"]
    twofa = await database.get_user_2fa(username)

    if not twofa or not twofa.get("totp_secret"):
        raise HTTPException(
            status_code=400,
            detail="No TOTP secret found — call GET /api/auth/2fa/setup first",
        )

    if not _verify_totp(twofa["totp_secret"], body.totp_code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code — try again")

    enabled = await database.enable_2fa(username)
    if not enabled:
        raise HTTPException(status_code=400, detail="Could not enable 2FA")

    return {"success": True, "two_factor_enabled": True, "message": "2FA activated successfully"}


@router.post("/2fa/disable")
async def disable_2fa(body: TotpVerifyRequest, payload: dict = Depends(_current_user)):
    """
    Deactivate 2FA for the caller after verifying one last TOTP code.

    Clears the stored secret as well.
    """
    username = payload["sub"]
    twofa = await database.get_user_2fa(username)

    if not twofa or not twofa.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled for this user")

    if not _verify_totp(twofa["totp_secret"], body.totp_code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    disabled = await database.disable_2fa(username)
    if not disabled:
        raise HTTPException(status_code=400, detail="Could not disable 2FA")

    return {"success": True, "two_factor_enabled": False, "message": "2FA deactivated successfully"}
