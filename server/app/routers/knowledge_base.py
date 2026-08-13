# -*- coding: utf-8 -*-
"""Knowledge base routes: /api/knowledge-bases (equivalent to original server/src/routes/knowledgeBase.ts)."""
import logging
from fastapi import APIRouter

from ..ragflow import ragflow_service
from ..security import ApiError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_knowledge_bases():
    try:
        kbs = await ragflow_service.get_datasets()
        return {"code": 0, "data": kbs}
    except Exception as e:
        logger.exception(f"Failed to fetch knowledge bases: {e}")
        raise ApiError(500, 1, str(e))
