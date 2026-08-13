# -*- coding: utf-8 -*-
"""Chat assistant routes: /api/chat-assistants.

Originally an inline route in the legacy server/src/index.ts.
"""
import logging
from fastapi import APIRouter

from ..ragflow import ragflow_service
from ..security import ApiError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_chat_assistants():
    try:
        assistants = await ragflow_service.get_chats()
        return {"code": 0, "data": assistants}
    except Exception as e:
        logger.exception(f"Failed to fetch chat assistants: {e}")
        raise ApiError(500, 1, str(e))
