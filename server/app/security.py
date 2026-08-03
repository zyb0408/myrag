# -*- coding: utf-8 -*-
"""JWT + bcrypt security helpers and FastAPI auth dependencies
(equivalent to original server/src/middleware/auth.ts).
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Request

from .config import JWT_SECRET

JWT_ALGORITHM = "HS256"
JWT_EXPIRES_IN = timedelta(days=7)  # equivalent to expiresIn: '7d'


@dataclass
class ApiError(Exception):
    """Unified API error carrying HTTP status + business code + message.

    Renders as `{"code": <code>, "message": <message>}` with the given HTTP status,
    matching the legacy Express `res.status(...).json({code, message})` contract.
    """

    status_code: int
    code: int
    message: str

    def __init__(self, status_code: int, code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass
class AuthUser:
    userId: str
    username: str
    isAdmin: bool


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def generate_token(user_id: str, username: str, is_admin: bool) -> str:
    payload = {
        "userId": user_id,
        "username": username,
        "isAdmin": is_admin,
        "exp": datetime.now(timezone.utc) + JWT_EXPIRES_IN,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> AuthUser | None:
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return AuthUser(
            userId=str(decoded.get("userId", "")),
            username=str(decoded.get("username", "")),
            isAdmin=bool(decoded.get("isAdmin", False)),
        )
    except jwt.PyJWTError:
        return None


def require_auth(request: Request) -> AuthUser:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ApiError(401, 401, "未登录，请先登录")
    token = auth_header[7:]
    user = verify_token(token)
    if not user:
        raise ApiError(401, 401, "登录已过期，请重新登录")
    return user


def require_admin(user: AuthUser = Depends(require_auth)) -> AuthUser:
    if not user.isAdmin:
        raise ApiError(403, 403, "仅管理员可操作")
    return user
