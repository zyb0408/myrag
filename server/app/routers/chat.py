# -*- coding: utf-8 -*-
"""Chat routes: /api/chat/* (equivalent to original server/src/routes/chat.ts).

POST /api/chat/{convId} proxies an OpenAI-compatible streaming chat completion
from RAGFlow and forwards each SSE `data:` event to the browser verbatim,
finishing with `data: [DONE]` (or `data: {"error": ...}` on failure).

POST /api/chat/{convId}/stop interrupts an in-flight generation by signalling
the asyncio.Event registered for that conversation.
"""
import asyncio
import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..db import execute, query_all, query_one, utc_now_iso
from ..ragflow import ragflow_service
from ..security import ApiError, AuthUser, require_auth

logger = logging.getLogger(__name__)

router = APIRouter()

CurrentUser = Annotated[AuthUser, Depends(require_auth)]

# Maps conversation_id -> asyncio.Event for in-flight streams,
# so POST /{conv_id}/stop can interrupt the corresponding generation.
_active_streams: dict[str, asyncio.Event] = {}


async def _parse_body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _simplify_references(refs: list) -> list:
    """Extract display-relevant fields from RAGFlow citation chunks.

    RAGFlow returns rich citation objects; we keep only what the UI needs and
    tolerate field-name variants across versions (document_name vs docnm_kwd,
    document_id vs doc_id, ...).
    """
    simplified = []
    for r in refs:
        if not isinstance(r, dict):
            continue
        simplified.append(
            {
                "document_name": r.get("document_name") or r.get("docnm_kwd") or "",
                "content": r.get("content") or r.get("content_with_weight") or "",
                "document_id": r.get("document_id") or r.get("doc_id") or "",
                "dataset_id": r.get("dataset_id") or r.get("kb_id") or "",
            }
        )
    return simplified


@router.post("/{conv_id}/stop")
async def stop_chat(conv_id: str, user: CurrentUser):
    # Verify ownership so a user cannot stop another user's stream
    conv = query_one("SELECT id FROM conversations WHERE id = ? AND user_id = ?", [conv_id, user.userId])
    if not conv:
        raise ApiError(404, 1, "Conversation not found")

    event = _active_streams.get(conv_id)
    if event:
        event.set()
        logger.info("Stop requested for conversation %s", conv_id)
    return {"code": 0, "data": {"stopped": bool(event)}}


@router.post("/{conv_id}")
async def chat(conv_id: str, request: Request, user: CurrentUser):
    body = await _parse_body(request)
    content = body.get("content")

    if not content:
        raise ApiError(400, 1, "content is required")

    # Get conversation info — verify ownership
    conv = query_one("SELECT * FROM conversations WHERE id = ? AND user_id = ?", [conv_id, user.userId])
    if not conv:
        raise ApiError(404, 1, "Conversation not found")

    now = utc_now_iso()

    # Save user message
    user_msg_id = str(uuid.uuid4())
    execute(
        'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        [user_msg_id, conv_id, "user", content, None, now],
    )

    # Update conversation timestamp
    execute("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conv_id])

    # Fetch all messages for context
    history = query_all(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        [conv_id],
    )
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    # Call RAGFlow with streaming
    client, resp = await ragflow_service.chat_completion(conv["assistant_id"], messages, True)

    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        raise ApiError(500, 1, "RAGFlow API error")

    # Register a cancel event so POST /{conv_id}/stop can interrupt the stream
    cancel_event = asyncio.Event()
    _active_streams[conv_id] = cancel_event

    async def event_stream():
        buffer = ""
        full_content = ""
        references: list = []
        try:
            async for chunk in resp.aiter_bytes():
                if cancel_event.is_set():
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                lines = buffer.split("\n")
                buffer = lines.pop()

                for line in lines:
                    if line.startswith("data: "):
                        data = line[6:].strip()
                        if data == "[DONE]":
                            continue

                        try:
                            parsed = json.loads(data)
                            delta = (parsed.get("choices") or [{}])[0].get("delta") or {}
                            text = delta.get("content") or ""
                            if text:
                                full_content += text
                            # Citations arrive in the final chunk's delta.reference
                            ref_raw = delta.get("reference")
                            if isinstance(ref_raw, list) and ref_raw:
                                references = _simplify_references(ref_raw)
                        except Exception:
                            # Skip unparseable chunks
                            pass

                        # Forward the SSE event to the client
                        yield f"{line}\n\n"

            # Save assistant message (persist references as JSON text).
            # Also runs after a stop (break): the partial answer is persisted.
            if full_content:
                assistant_msg_id = str(uuid.uuid4())
                ref_json = json.dumps(references, ensure_ascii=False) if references else None
                execute(
                    'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) '
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    [assistant_msg_id, conv_id, "assistant", full_content, ref_json, utc_now_iso()],
                )

            # Emit a dedicated references event so the client can render sources
            if references:
                yield f"data: {json.dumps({'references': references}, ensure_ascii=False)}\n\n"

            # Send DONE signal
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Stream read error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            _active_streams.pop(conv_id, None)
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
