# -*- coding: utf-8 -*-
"""Knowledge base routes: /api/knowledge-bases (equivalent to original server/src/routes/knowledgeBase.ts)."""
from fastapi import APIRouter

from ..ragflow import ragflow_service
from ..security import ApiError

router = APIRouter()


@router.get("")
async def list_knowledge_bases():
    try:
        kbs = await ragflow_service.get_datasets()
        return {"code": 0, "data": kbs}
    except Exception as e:
        print(f"Failed to fetch knowledge bases: {e}")
        raise ApiError(500, 1, str(e))
