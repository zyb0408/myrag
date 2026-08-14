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

from ..config import RAGFLOW_API_VERSION, RAGFLOW_BASE_URL
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


async def _stream_from_non_streaming(body: dict, conv_id: str):
    """Convert a non-streaming RAGFlow response body into SSE events."""
    try:
        choices = body.get("choices", [])
        full_content = ""
        references: list = []

        if choices:
            choice = choices[0]
            if isinstance(choice, list) and choice:
                choice = choice[0]
            if isinstance(choice, dict):
                message = choice.get("message", {})
                full_content = message.get("content", "") or ""

                ref_data = body.get("reference") or choice.get("reference") or []
                if isinstance(ref_data, list):
                    references = _simplify_references(ref_data)

        # Yield the content as a single SSE event
        if full_content:
            # Simulate an SSE chunk with the full content
            chunk = {
                "choices": [{
                    "delta": {"content": full_content},
                    "index": 0,
                }],
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

        # Emit references event
        if references:
            yield f"data: {json.dumps({'references': references}, ensure_ascii=False)}\n\n"

        # Send DONE
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.exception("Error converting non-streaming response to SSE for conversation %s", conv_id)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


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
    try:
        client, resp = await ragflow_service.chat_completion(conv["assistant_id"], messages, True)
    except Exception as e:
        logger.error("RAGFlow chat_completion failed: %s", e)
        # Fallback: try non-streaming request
        logger.warning("Attempting non-streaming fallback for conversation %s...", conv_id)
        try:
            import httpx as _httpx
            url = f"{RAGFLOW_BASE_URL}/api/v1/chats_openai/{conv['assistant_id']}/chat/completions"
            fallback_payload = {
                "model": "model",
                "messages": messages,
                "stream": False,
            }
            if RAGFLOW_API_VERSION == "v0.24+":
                fallback_payload["extra_body"] = {"reference": True, "reference_metadata": {"include": True}}
            else:
                fallback_payload["reference"] = True
            async with _httpx.AsyncClient(timeout=_httpx.Timeout(60.0)) as fb_client:
                fb_resp = await fb_client.post(url, headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {ragflow_service.api_key}",
                }, json=fallback_payload)
                logger.info("Non-streaming response: status=%d", fb_resp.status_code)
                if fb_resp.status_code < 400:
                    fb_body = fb_resp.json()
                    logger.info("Non-streaming body: %s", json.dumps(fb_body, ensure_ascii=False)[:1000])

                    # Extract content and references (handle both 1D and 2D choices)
                    fb_choices = fb_body.get("choices", [])
                    fb_content = ""
                    fb_refs: list = []
                    if fb_choices:
                        fb_choice = fb_choices[0]
                        if isinstance(fb_choice, list) and fb_choice:
                            fb_choice = fb_choice[0]
                        if isinstance(fb_choice, dict):
                            fb_msg = fb_choice.get("message", {})
                            fb_content = fb_msg.get("content", "") or ""
                            ref_raw = fb_body.get("reference") or fb_choice.get("reference") or []
                            if isinstance(ref_raw, list):
                                fb_refs = _simplify_references(ref_raw)

                    # Save assistant message
                    if fb_content:
                        asst_msg_id = str(uuid.uuid4())
                        ref_json = json.dumps(fb_refs, ensure_ascii=False) if fb_refs else None
                        execute(
                            'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) '
                            "VALUES (?, ?, ?, ?, ?, ?)",
                            [asst_msg_id, conv_id, "assistant", fb_content, ref_json, utc_now_iso()],
                        )
                        logger.info("Assistant message saved (non-streaming) for conversation %s", conv_id)

                    return StreamingResponse(
                        _stream_from_non_streaming(fb_body, conv_id),
                        media_type="text/event-stream",
                        headers={
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "X-Accel-Buffering": "no",
                        },
                    )
                else:
                    logger.error("Non-streaming fallback failed: status=%d, body=%s", fb_resp.status_code, fb_resp.text[:500])
                    raise ApiError(500, 1, f"RAGFlow API error: {fb_resp.status_code}")
        except ApiError:
            raise
        except Exception as fallback_err:
            logger.error("Non-streaming fallback also failed: %s", fallback_err)
            raise ApiError(500, 1, f"RAGFlow API error: {e}")

    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        raise ApiError(500, 1, "RAGFlow API error")

    # Log response headers for debugging
    logger.info("RAGFlow response: status=%d, content-type=%s, transfer-encoding=%s, content-length=%s", 
                resp.status_code, 
                resp.headers.get('content-type', 'unknown'),
                resp.headers.get('transfer-encoding', 'unknown'),
                resp.headers.get('content-length', 'unknown'))

    # Register a cancel event so POST /{conv_id}/stop can interrupt the stream
    cancel_event = asyncio.Event()
    _active_streams[conv_id] = cancel_event

    async def event_stream():
        buffer = ""
        full_content = ""
        references: list = []
        chunk_count = 0
        raw_chunks = 0
        final_content_seen = False
        try:
            logger.info("Starting SSE stream for conversation %s (assistant: %s)", conv_id, conv["assistant_id"])
            async for chunk in resp.aiter_bytes():
                raw_chunks += 1
                if raw_chunks <= 3:
                    decoded = chunk.decode("utf-8", errors="replace")
                    has_newline = "\n" in decoded
                    has_cr = "\r" in decoded
                    logger.info("SSE chunk #%d: %d bytes, has_newline=%s, has_cr=%s, preview=%s",
                                raw_chunks, len(chunk), has_newline, has_cr, decoded[:200])
                if cancel_event.is_set():
                    logger.info("Stream cancelled for conversation %s", conv_id)
                    break
                # Normalize line endings: SSE spec allows \r\n, \r, and \n as line separators
                buffer += chunk.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
                lines = buffer.split("\n")
                buffer = lines.pop()

                # Log first few lines after split for debugging
                if raw_chunks <= 3 and lines:
                    for i, l in enumerate(lines[:2]):
                        logger.info("Line %d after split (raw_chunks=%d): starts_with_data=%s, first_30_chars=%s",
                                    i, raw_chunks, l.startswith("data:"), repr(l[:30]))

                for line in lines:
                    # SSE spec: field is "data:", value may optionally start with a space
                    # RAGFlow sends "data:{...}" without space; OpenAI sends "data: {...}" with space
                    if line.startswith("data:"):
                        data = line[5:].lstrip()  # strip "data:" prefix and optional space
                        if data == "[DONE]":
                            continue

                        try:
                            parsed = json.loads(data)
                            choices = parsed.get("choices") or []
                            # Handle both 1D [{...}] and 2D [[{...}]] choices arrays
                            if choices and isinstance(choices[0], list):
                                choice = choices[0][0] if choices[0] else {}
                            elif choices and isinstance(choices[0], dict):
                                choice = choices[0]
                            else:
                                choice = {}
                            delta = choice.get("delta") or {}

                            # Log first parsed chunk structure for debugging
                            if chunk_count == 0:
                                logger.info("First parsed chunk: choice type=%s, delta keys=%s, delta=%s",
                                            type(choice).__name__,
                                            list(delta.keys()) if isinstance(delta, dict) else "non-dict",
                                            json.dumps(delta, ensure_ascii=False)[:300])

                            # 1) 增量文本（流式 token）
                            text = delta.get("content") or ""
                            # RAGFlow 思考过程在 reasoning_content 字段
                            reasoning = delta.get("reasoning_content") or ""
                            if text:
                                full_content += text
                            elif reasoning:
                                full_content += reasoning

                            # 2) RAGFlow 新字段：final_content（最终完整答案）
                            final_content = parsed.get("final_content") or delta.get("final_content")
                            if final_content and isinstance(final_content, str) and not final_content_seen:
                                final_content_seen = True
                                logger.info("RAGFlow final_content received (%d chars)", len(final_content))
                                if final_content.strip():
                                    full_content = final_content

                            # 3) 引用：可能位于 delta.reference 或顶层 reference 字段
                            ref_raw = delta.get("reference")
                            if not isinstance(ref_raw, list) or not ref_raw:
                                ref_raw = parsed.get("reference")
                            if isinstance(ref_raw, list) and ref_raw:
                                references = _simplify_references(ref_raw)
                        except Exception as e:
                            # Log parsing failures for debugging
                            logger.warning("Failed to parse SSE data: %s, error: %s", data[:150], str(e))
                            pass

                        chunk_count += 1
                        # Forward the SSE event to the client
                        yield f"{line}\n\n"

            logger.info("Stream finished for conversation %s: %d raw_chunks, %d parsed_chunks, %d chars content, %d references",
                        conv_id, raw_chunks, chunk_count, len(full_content), len(references))

            # Debug: if we received data but no parsed chunks, log the buffer content
            if raw_chunks > 0 and chunk_count == 0 and buffer:
                logger.warning("Raw data received but no valid SSE chunks parsed. Buffer preview: %s", buffer[:500])

            # Fallback: if streaming yielded nothing, try reading the body directly
            if raw_chunks == 0:
                logger.warning("Stream yielded 0 chunks for conversation %s. Attempting to read body directly...", conv_id)
                try:
                    remaining = await resp.aread()
                    if remaining:
                        logger.warning("Found %d unread bytes after stream ended. Body: %s", len(remaining), remaining.decode("utf-8", errors="replace")[:500])
                    else:
                        logger.warning("No unread body bytes remaining after stream ended. Response body was empty.")
                except Exception as e:
                    logger.warning("Could not read remaining body: %s", e)

                # Attempt a non-streaming fallback: make a new request without stream
                logger.warning("Attempting non-streaming fallback for conversation %s...", conv_id)
                try:
                    import httpx as _httpx
                    url = f"{RAGFLOW_BASE_URL}/api/v1/chats_openai/{conv['assistant_id']}/chat/completions"
                    fallback_payload = {
                        "model": "model",
                        "messages": messages,
                        "stream": False,
                    }
                    if RAGFLOW_API_VERSION == "v0.24+":
                        fallback_payload["extra_body"] = {"reference": True, "reference_metadata": {"include": True}}
                    else:
                        fallback_payload["reference"] = True
                    async with _httpx.AsyncClient(timeout=_httpx.Timeout(60.0)) as fb_client:
                        fb_resp = await fb_client.post(url, headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {ragflow_service.api_key}",
                        }, json=fallback_payload)
                        if fb_resp.status_code < 400:
                            fb_body = fb_resp.json()
                            logger.warning("Non-streaming fallback response: %s", json.dumps(fb_body, ensure_ascii=False)[:1000])
                            choices = fb_body.get("choices", [])
                            if choices:
                                msg = choices[0].get("message", {})
                                full_content = msg.get("content", "") or ""
                                ref_data = fb_body.get("reference") or choices[0].get("reference") or []
                                if isinstance(ref_data, list):
                                    references = _simplify_references(ref_data)
                                logger.info("Non-streaming fallback recovered %d chars content, %d references", len(full_content), len(references))
                        else:
                            logger.warning("Non-streaming fallback failed with status %d: %s", fb_resp.status_code, fb_resp.text[:500])
                except Exception as e:
                    logger.warning("Non-streaming fallback exception: %s", e)

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
                logger.info("Assistant message saved for conversation %s", conv_id)
            else:
                logger.warning("No content received from RAGFlow for conversation %s", conv_id)

            # Emit a dedicated references event so the client can render sources
            if references:
                yield f"data: {json.dumps({'references': references}, ensure_ascii=False)}\n\n"

            # Emit the final (complete) content so the frontend can fill the
            # assistant bubble even when RAGFlow's incremental `delta.content`
            # is empty (newer RAGFlow versions expose the full answer via
            # `final_content` on the last chunk).
            if final_content_seen and full_content:
                yield f"data: {json.dumps({'final_content': full_content}, ensure_ascii=False)}\n\n"

            # Send DONE signal
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Stream read error for conversation %s", conv_id)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            _active_streams.pop(conv_id, None)
            await resp.aclose()
            await client.aclose()
            logger.info("Stream resources cleaned up for conversation %s", conv_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
