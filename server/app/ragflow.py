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
import httpx

from .config import RAGFLOW_API_KEY, RAGFLOW_BASE_URL

REQUEST_TIMEOUT = 30.0  # seconds for non-streaming calls


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
        """
        url = f"{self.base_url}/api/v1/openai/{assistant_id}/chat/completions"
        client = httpx.AsyncClient(timeout=None)
        try:
            req = client.build_request(
                "POST",
                url,
                headers=self.headers,
                json={"model": "model", "messages": messages, "stream": stream, "reference": True},
            )
            resp = await client.send(req, stream=True)
        except Exception:
            await client.aclose()
            raise
        return client, resp


ragflow_service = RAGFlowService()
