"""
User management router — Sprint 4.

Endpoints (admin-only):
  GET    /api/users              — list all users
  POST   /api/users              — create a new user
  DELETE /api/users/{user_id}    — deactivate a user
  POST   /api/users/{user_id}/password — change a user's password
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import database
from auth_jwt import hash_password, require_admin

router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)
    role: str = Field("trader", pattern="^(admin|trader)$")


class ChangePasswordRequest(BaseModel):
    password: str = Field(..., min_length=8)


@router.get("")
async def list_users(_admin=Depends(require_admin)):
    """Return all users (passwords excluded)."""
    users = await database.list_users()
    return {"users": users, "count": len(users)}


@router.post("", status_code=201)
async def create_user(body: CreateUserRequest, _admin=Depends(require_admin)):
    """Create a new user account."""
    hashed = hash_password(body.password)
    try:
        user = await database.create_user(body.username, hashed, role=body.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"success": True, "user": user}


@router.delete("/{user_id}")
async def delete_user(user_id: str, _admin=Depends(require_admin)):
    """Deactivate (soft-delete) a user."""
    found = await database.delete_user(user_id)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user_id": user_id}


@router.post("/{user_id}/password")
async def change_password(user_id: str, body: ChangePasswordRequest, _admin=Depends(require_admin)):
    """Update a user's password."""
    hashed = hash_password(body.password)
    found = await database.update_user_password(user_id, hashed)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}
