# -*- coding: utf-8 -*-
"""RAGFlow HTTP client (equivalent to original server/src/services/ragflow.ts).

Endpoints follow the official RAGFlow Python API reference
(https://ragflow.io/docs/python_api_reference):

- GET  /api/v1/datasets?page=1&page_size=100            list datasets
- GET  /api/v1/chats                                    list chat assistants
- GET  /api/v1/chats/{id}                               single chat assistant
- POST /api/v1/openai/{chat_id}/chat/completions        OpenAI-compatible chat completion (SSE)

Auth: `Authorization: Bearer <RAGFLOW_API_KEY>`, `Content-Type: application/json`.
"""
import json
import logging

import httpx

from .config import RAGFLOW_API_KEY, RAGFLOW_API_VERSION, RAGFLOW_BASE_URL

REQUEST_TIMEOUT = 30.0  # seconds for non-streaming calls

logger = logging.getLogger(__name__)


class RAGFlowService:
    def __init__(self) -> None:
        self.base_url = RAGFLOW_BASE_URL.rstrip("/")
        self.api_key = RAGFLOW_API_KEY
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    async def _request(self, path: str) -> dict:
        """GET request helper; raises RuntimeError on HTTP error / business error."""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(url, headers=self.headers)
            try:
                data = resp.json()
            except ValueError:
                data = None

            if resp.status_code >= 400:
                msg = (data or {}).get("message") or (data or {}).get("msg") or resp.reason_phrase
                raise RuntimeError(f"RAGFlow API error: {msg} ({resp.status_code})")
            return data or {}

    async def get_datasets(self) -> list:
        resp = await self._request("/api/v1/datasets?page=1&page_size=100")
        if resp.get("code") != 0:
            raise RuntimeError("Failed to fetch knowledge bases")
        return resp.get("data", [])

    async def get_chats(self) -> list:
        resp = await self._request("/api/v1/chats")
        if resp.get("code") != 0:
            raise RuntimeError("Failed to fetch chat assistants")
        return resp.get("data", [])

    async def get_chat(self, chat_id: str) -> dict:
        resp = await self._request(f"/api/v1/chats/{chat_id}")
        if resp.get("code") != 0:
            raise RuntimeError("Failed to fetch chat assistant")
        return resp.get("data", {})

    async def chat_completion(
        self,
        assistant_id: str,
        messages: list[dict],
        stream: bool = True,
    ) -> tuple[httpx.AsyncClient, httpx.Response]:
        """OpenAI-compatible streaming chat completion.

        Returns the (client, response) pair; the caller must consume the body and
        close both. `stream=True` keeps the connection open for SSE forwarding.

        Supports both RAGFlow v0.24+ (extra_body format) and older versions
        (top-level reference parameter).
        """
        url = f"{self.base_url}/api/v1/openai/{assistant_id}/chat/completions"
        client = httpx.AsyncClient(timeout=None)

        # Build request payload based on configured API version
        if RAGFLOW_API_VERSION == "v0.24+":
            # v0.24+ format: reference and reference_metadata go into extra_body
            payload = {
                "model": "model",
                "messages": messages,
                "stream": stream,
                "extra_body": {
                    "reference": True,
                    "reference_metadata": {"include": True},
                },
            }
        else:
            # Legacy format (pre-v0.24): reference is a top-level parameter
            payload = {
                "model": "model",
                "messages": messages,
                "stream": stream,
                "reference": True,
            }

        logger.info("Using RAGFlow API version: %s, payload keys: %s", RAGFLOW_API_VERSION, list(payload.keys()))
        logger.info("RAGFlow request: POST %s, payload=%s", url, json.dumps(payload, ensure_ascii=False))

        try:
            req = client.build_request("POST", url, headers=self.headers, json=payload)
            resp = await client.send(req, stream=True)

            # Log full response headers for debugging
            header_dict = dict(resp.headers)
            logger.info("RAGFlow response: status=%d, headers=%s", resp.status_code, header_dict)

            if resp.status_code >= 400:
                error_text = await resp.aread()
                error_detail = error_text.decode('utf-8', errors='replace')
                logger.error("RAGFlow API error: %s", error_detail[:500])
                await resp.aclose()
                await client.aclose()
                raise RuntimeError(f"RAGFlow API error ({resp.status_code}): {error_detail}")

            # If response is not SSE (content-type doesn't contain text/event-stream),
            # the stream iterator may yield nothing. Fall back to reading full body.
            content_type = resp.headers.get("content-type", "")
            if "text/event-stream" not in content_type:
                logger.warning("RAGFlow response content-type is '%s', not 'text/event-stream'. This may cause streaming issues.", content_type)
                body_bytes = await resp.aread()
                body_text = body_bytes.decode("utf-8", errors="replace")
                logger.warning("RAGFlow non-SSE response body (first 1000 chars): %s", body_text[:1000])
                await resp.aclose()
                await client.aclose()
                raise RuntimeError(f"RAGFlow returned non-SSE response (content-type: {content_type}). Body: {body_text[:500]}")

            return client, resp
        except Exception:
            await client.aclose()
            raise


ragflow_service = RAGFlowService()
