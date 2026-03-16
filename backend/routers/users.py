"""
User management router — Sprint 4.

Endpoints (admin-only):
  GET    /api/users              — list all users
  POST   /api/users              — create a new user
  DELETE /api/users/{user_id}    — deactivate a user
  POST   /api/users/{user_id}/password — change a user's password
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

import database
from auth_jwt import decode_token, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])
_security = HTTPBearer(auto_error=False)


def _require_admin(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> dict:
    """Dependency: verify JWT and require admin role."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return payload


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)
    role: str = Field("trader", pattern="^(admin|trader)$")


class ChangePasswordRequest(BaseModel):
    password: str = Field(..., min_length=8)


@router.get("")
async def list_users(_admin=Depends(_require_admin)):
    """Return all users (passwords excluded)."""
    users = await database.list_users()
    return {"users": users, "count": len(users)}


@router.post("", status_code=201)
async def create_user(body: CreateUserRequest, _admin=Depends(_require_admin)):
    """Create a new user account."""
    hashed = hash_password(body.password)
    try:
        user = await database.create_user(body.username, hashed, role=body.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"success": True, "user": user}


@router.delete("/{user_id}")
async def delete_user(user_id: str, _admin=Depends(_require_admin)):
    """Deactivate (soft-delete) a user."""
    found = await database.delete_user(user_id)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user_id": user_id}


@router.post("/{user_id}/password")
async def change_password(user_id: str, body: ChangePasswordRequest, _admin=Depends(_require_admin)):
    """Update a user's password."""
    hashed = hash_password(body.password)
    found = await database.update_user_password(user_id, hashed)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}
