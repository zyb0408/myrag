# -*- coding: utf-8 -*-
"""Conversation routes: /api/conversations/* (equivalent to original server/src/routes/conversation.ts).

All routes require JWT auth.
"""
import logging
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from ..db import execute, query_all, query_one, utc_now_iso
from ..security import ApiError, AuthUser, require_auth

logger = logging.getLogger(__name__)

router = APIRouter()

CurrentUser = Annotated[AuthUser, Depends(require_auth)]


def _zh_cn_locale_string(dt: datetime) -> str:
    """Reproduce JS `new Date().toLocaleString('zh-CN')` output, e.g. `2026/8/3 21:26:36`."""
    return f"{dt.year}/{dt.month}/{dt.day} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}"


def _ok(data):
    """Wrap a successful payload; omit the `data` key when it is None —
    mirrors Express `res.json({code:0, data: undefined})` which drops the key."""
    payload = {"code": 0}
    if data is not None:
        payload["data"] = data
    return payload


async def _parse_body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("")
async def list_conversations(request: Request, user: CurrentUser):
    try:
        kb_id = request.query_params.get("kb_id")
        if kb_id:
            conversations = query_all(
                "SELECT * FROM conversations WHERE kb_id = ? AND user_id = ? ORDER BY updated_at DESC",
                [kb_id, user.userId],
            )
        else:
            conversations = query_all(
                "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
                [user.userId],
            )
        return _ok(conversations)
    except Exception as e:
        logger.exception(f"Failed to list conversations: {e}")
        raise ApiError(500, 1, str(e))


@router.post("")
async def create_conversation(request: Request, user: CurrentUser):
    try:
        body = await _parse_body(request)
        name = body.get("name")
        assistant_id = body.get("assistant_id")
        kb_id = body.get("kb_id")
        kb_name = body.get("kb_name")

        if not assistant_id or not kb_id or not kb_name:
            raise ApiError(400, 1, "assistant_id, kb_id, and kb_name are required")

        now = utc_now_iso()
        conv_id = str(uuid.uuid4())
        conv_name = name or f"新对话 {_zh_cn_locale_string(datetime.now())}"

        execute(
            "INSERT INTO conversations (id, name, assistant_id, kb_id, kb_name, user_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [conv_id, conv_name, assistant_id, kb_id, kb_name, user.userId, now, now],
        )

        conversation = query_one(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            [conv_id, user.userId],
        )
        return _ok(conversation)
    except ApiError:
        raise
    except Exception as e:
        logger.exception(f"Failed to create conversation: {e}")
        raise ApiError(500, 1, str(e))


@router.patch("/{conv_id}")
async def rename_conversation(conv_id: str, request: Request, user: CurrentUser):
    try:
        body = await _parse_body(request)
        name = body.get("name")

        if not name:
            raise ApiError(400, 1, "name is required")

        execute(
            "UPDATE conversations SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            [name, utc_now_iso(), conv_id, user.userId],
        )

        conversation = query_one(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            [conv_id, user.userId],
        )
        return _ok(conversation)
    except ApiError:
        raise
    except Exception as e:
        logger.exception(f"Failed to rename conversation: {e}")
        raise ApiError(500, 1, str(e))


@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, user: CurrentUser):
    try:
        execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", [conv_id, user.userId])
        return _ok(True)
    except Exception as e:
        logger.exception(f"Failed to delete conversation: {e}")
        raise ApiError(500, 1, str(e))


@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, user: CurrentUser):
    try:
        # Verify the conversation belongs to this user
        conv = query_one("SELECT id FROM conversations WHERE id = ? AND user_id = ?", [conv_id, user.userId])
        if not conv:
            raise ApiError(404, 1, "Conversation not found")

        messages = query_all(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            [conv_id],
        )
        return _ok(messages)
    except ApiError:
        raise
    except Exception as e:
        logger.exception(f"Failed to get messages: {e}")
        raise ApiError(500, 1, str(e))
