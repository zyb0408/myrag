# -*- coding: utf-8 -*-
"""Chat routes: /api/chat/* (equivalent to original server/src/routes/chat.ts).

POST /api/chat/{convId} proxies an OpenAI-compatible streaming chat completion
from RAGFlow and forwards each SSE `data:` event to the browser verbatim,
finishing with `data: [DONE]` (or `data: {"error": ...}` on failure).
"""
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..db import execute, query_all, query_one, utc_now_iso
from ..ragflow import ragflow_service
from ..security import ApiError, AuthUser, require_auth

router = APIRouter()

CurrentUser = Annotated[AuthUser, Depends(require_auth)]


async def _parse_body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.post("/{conv_id}/stop")
async def stop_chat(conv_id: str, user: CurrentUser):
    # Placeholder implementation — same behavior as the legacy backend
    return {"code": 0, "data": {"stopped": True}}


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

    async def event_stream():
        buffer = ""
        full_content = ""
        try:
            async for chunk in resp.aiter_bytes():
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
                        except Exception:
                            # Skip unparseable chunks
                            pass

                        # Forward the SSE event to the client
                        yield f"{line}\n\n"

            # Save assistant message
            if full_content:
                assistant_msg_id = str(uuid.uuid4())
                execute(
                    'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) '
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    [assistant_msg_id, conv_id, "assistant", full_content, None, utc_now_iso()],
                )

            # Send DONE signal
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Stream read error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
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
