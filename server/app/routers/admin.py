# -*- coding: utf-8 -*-
"""Admin routes: /api/admin/* (equivalent to original server/src/routes/admin.ts).

All routes require JWT auth + admin role.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from ..db import execute, query_all, query_one, utc_now_iso
from ..security import ApiError, AuthUser, hash_password, require_admin

router = APIRouter()

AdminUser = Annotated[AuthUser, Depends(require_admin)]


@router.get("/users")
async def list_users(user: AdminUser):
    try:
        users = query_all(
            "SELECT id, username, display_name, must_reset_password, is_active, is_admin, created_at "
            "FROM users ORDER BY created_at ASC"
        )
        return {
            "code": 0,
            "data": [
                {
                    "id": u["id"],
                    "username": u["username"],
                    "displayName": u["display_name"],
                    "mustResetPassword": bool(u["must_reset_password"]),
                    "isActive": bool(u["is_active"]),
                    "isAdmin": bool(u["is_admin"]),
                    "createdAt": u["created_at"],
                }
                for u in users
            ],
        }
    except Exception:
        raise ApiError(500, 1, "获取用户列表失败")


@router.post("/users")
async def create_user(user: AdminUser, request: Request):
    try:
        try:
            body = await request.json()
            body = body if isinstance(body, dict) else {}
        except Exception:
            body = {}

        username = body.get("username")
        password = body.get("password")
        display_name = body.get("displayName")

        if not username or not password or not display_name:
            raise ApiError(400, 1, "用户名、密码和显示名称不能为空")

        if len(password) < 6:
            raise ApiError(400, 1, "密码至少 6 位")

        existing = query_all("SELECT id FROM users WHERE username = ?", [username])
        if existing:
            raise ApiError(400, 1, "用户名已存在")

        user_id = str(uuid.uuid4())
        hashed = hash_password(password)
        now = utc_now_iso()

        execute(
            "INSERT INTO users (id, username, password_hash, display_name, must_reset_password, is_active, is_admin, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [user_id, username, hashed, display_name, 1, 1, 0, now],
        )

        return {
            "code": 0,
            "data": {
                "id": user_id,
                "username": username,
                "displayName": display_name,
                "mustResetPassword": True,
                "isActive": True,
                "isAdmin": False,
            },
        }
    except ApiError:
        raise
    except Exception as e:
        print(f"Create user error: {e}")
        raise ApiError(500, 1, "创建用户失败")


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: AdminUser):
    try:
        # Don't allow deleting yourself
        if user_id == user.userId:
            raise ApiError(400, 1, "不能删除自己")

        # Check if it's the last active admin
        target = query_one("SELECT is_admin FROM users WHERE id = ?", [user_id])
        if target and target["is_admin"]:
            admin_count = query_one(
                "SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND is_active = 1"
            )
            if admin_count and admin_count["count"] <= 1:
                raise ApiError(400, 1, "不能删除最后一个管理员")

        execute("DELETE FROM users WHERE id = ?", [user_id])
        # Cascade delete the user's conversations (messages cascade via FK)
        execute("DELETE FROM conversations WHERE user_id = ?", [user_id])

        return {"code": 0, "data": {"success": True}}
    except ApiError:
        raise
    except Exception as e:
        print(f"Delete user error: {e}")
        raise ApiError(500, 1, "删除用户失败")


@router.patch("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, user: AdminUser, request: Request):
    try:
        try:
            body = await request.json()
            body = body if isinstance(body, dict) else {}
        except Exception:
            body = {}

        new_password = body.get("newPassword")

        if not new_password or len(new_password) < 6:
            raise ApiError(400, 1, "新密码至少 6 位")

        hashed = hash_password(new_password)
        execute(
            "UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?",
            [hashed, user_id],
        )

        return {"code": 0, "data": {"success": True}}
    except ApiError:
        raise
    except Exception:
        raise ApiError(500, 1, "重置密码失败")
