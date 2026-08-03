# -*- coding: utf-8 -*-
"""Auth routes: /api/auth/* (equivalent to original server/src/routes/auth.ts).

Public routes — no JWT required.
"""
from fastapi import APIRouter, Depends, Request

from ..db import query_one, execute
from ..security import ApiError, AuthUser, generate_token, hash_password, require_auth, verify_password

router = APIRouter()


async def parse_body(request: Request) -> dict:
    """Best-effort JSON body parsing — mirrors Express `req.body` semantics:
    missing / invalid body yields an empty dict instead of an error."""
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _user_payload(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "displayName": u["display_name"],
        "isAdmin": bool(u["is_admin"]),
        "mustResetPassword": bool(u["must_reset_password"]),
    }


@router.post("/login")
async def login(request: Request):
    try:
        body = await parse_body(request)
        username = body.get("username")
        password = body.get("password")

        if not username or not password:
            raise ApiError(400, 1, "用户名和密码不能为空")

        user = query_one("SELECT * FROM users WHERE username = ?", [username])
        if not user:
            raise ApiError(401, 1, "用户名或密码错误")

        if not user["is_active"]:
            raise ApiError(403, 1, "账号已被禁用")

        if not verify_password(password, user["password_hash"]):
            raise ApiError(401, 1, "用户名或密码错误")

        token = generate_token(user["id"], user["username"], bool(user["is_admin"]))
        return {"code": 0, "data": {"token": token, "user": _user_payload(user)}}
    except ApiError:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise ApiError(500, 1, "登录失败")


@router.post("/reset-password")
async def reset_password(request: Request):
    try:
        body = await parse_body(request)
        username = body.get("username")
        old_password = body.get("oldPassword")
        new_password = body.get("newPassword")

        if not username or not old_password or not new_password:
            raise ApiError(400, 1, "参数不完整")

        if len(new_password) < 6:
            raise ApiError(400, 1, "新密码至少 6 位")

        user = query_one("SELECT * FROM users WHERE username = ?", [username])
        if not user:
            raise ApiError(404, 1, "用户不存在")

        if not verify_password(old_password, user["password_hash"]):
            raise ApiError(401, 1, "原密码错误")

        new_hash = hash_password(new_password)
        execute(
            "UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?",
            [new_hash, user["id"]],
        )
        return {"code": 0, "data": {"success": True}}
    except ApiError:
        raise
    except Exception as e:
        print(f"Reset password error: {e}")
        raise ApiError(500, 1, "修改密码失败")


@router.get("/me")
async def me(user: AuthUser = Depends(require_auth)):
    try:
        u = query_one("SELECT * FROM users WHERE id = ?", [user.userId])
        if not u:
            raise ApiError(404, 1, "用户不存在")
        return {"code": 0, "data": _user_payload(u)}
    except ApiError:
        raise
    except Exception:
        raise ApiError(500, 1, "获取用户信息失败")
