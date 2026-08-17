# -*- coding: utf-8 -*-
"""Mock RAGFlow service for integration testing (listens on 9380).

Simulates the RAGFlow HTTP API surface used by the BFF:
- GET  /api/v1/datasets?page=1&page_size=100
- GET  /api/v1/chats
- POST /api/v1/chats_openai/{chat_id}/chat/completions  (SSE stream)

Run: python mock_ragflow.py  (or: uv run python tests/mock_ragflow.py)
"""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 9380

DATASETS = [
    {
        "id": "kb-001",
        "name": "产品手册知识库",
        "description": "mock 数据集：产品使用手册",
        "document_count": 3,
        "chunk_count": 42,
        "embedding_model": "BAAI/bge-large-zh-v1.5@BAAI",
        "status": "1",
        "create_time": 1700000000,
        "update_time": 1700000100,
    },
    {
        "id": "kb-002",
        "name": "FAQ 知识库",
        "description": "mock 数据集：常见问题",
        "document_count": 1,
        "chunk_count": 8,
        "embedding_model": "BAAI/bge-large-zh-v1.5@BAAI",
        "status": "1",
        "create_time": 1700000001,
        "update_time": 1700000101,
    },
]

CHATS = [
    {
        "id": "chat-001",
        "name": "产品助手",
        "description": "mock 助手：产品问答",
        "dataset_ids": ["kb-001", "kb-002"],
        "kb_names": ["产品手册知识库", "FAQ 知识库"],
        "llm_id": "glm-4-flash@ZHIPU-AI",
        "icon": "",
        "status": "1",
        "create_time": 1700000000,
        "update_time": 1700000100,
    }
]

STREAM_PIECES = ["你好，", "这是来自", "RAGFlow 的", "流式测试回复。"]

# RAGFlow v0.24+ format: reference is an object with 'chunks' key
REFERENCE_CHUNK = {
    "choices": [{
        "delta": {
            "content": "",
            "reference": {
                "chunks": {
                    "20": {
                        "id": "4b8935ac0a22deb1",
                        "content": "这是引用的文档内容片段，包含产品使用手册的详细说明...",
                        "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "document_name": "INSTALL22.md",
                        "document_metadata": {"author": "bob", "year": "2023"},
                        "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                        "similarity": 0.5697155305154673,
                        "vector_similarity": 0.7323851005515574,
                        "term_similarity": 0.5000000005,
                        "positions": [[12, 11, 11, 11, 11]],
                        "url": None,
                        "doc_type": "",
                    },
                    "21": {
                        "id": "5c9a46bd1b23ef2",
                        "content": "这是第二篇引用文档的内容，包含常见问题解答...",
                        "document_id": "5bce3aa7f26211f0907f09f583941b46",
                        "document_name": "FAQ.md",
                        "document_metadata": {"author": "alice", "year": "2024"},
                        "dataset_id": "678de70d5e1511f0907f09f583941b46",
                        "similarity": 0.4823451098765432,
                        "vector_similarity": 0.6512345678901234,
                        "term_similarity": 0.4500000001,
                        "positions": [[5, 3, 3, 3, 3]],
                        "url": None,
                        "doc_type": "",
                    },
                },
                "doc_aggs": {
                    "INSTALL22.md": {
                        "doc_name": "INSTALL22.md",
                        "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "count": 1,
                    },
                    "FAQ.md": {
                        "doc_name": "FAQ.md",
                        "doc_id": "5bce3aa7f26211f0907f09f583941b46",
                        "count": 1,
                    },
                },
            },
        },
    }],
}


class MockHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/v1/datasets":
            self._send_json({"code": 0, "data": DATASETS})
        elif path == "/api/v1/chats":
            self._send_json({"code": 0, "data": CHATS})
        elif path.startswith("/api/v1/chats/"):
            chat_id = path.rsplit("/", 1)[-1]
            found = next((c for c in CHATS if c["id"] == chat_id), None)
            if found:
                self._send_json({"code": 0, "data": found})
            else:
                self._send_json({"code": 1, "message": "Chat not found"}, status=404)
        else:
            self._send_json({"code": 1, "message": "Not Found"}, status=404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/v1/chats_openai/") and path.endswith("/chat/completions"):
            length = int(self.headers.get("Content-Length", 0))
            if length:
                self.rfile.read(length)  # consume request body
            # OpenAI-compatible SSE stream
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            for piece in STREAM_PIECES:
                event = {"choices": [{"delta": {"content": piece}}]}
                self.wfile.write(f"data:{json.dumps(event, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()
                time.sleep(0.05)
            # Send reference chunk in RAGFlow v0.24+ format (object)
            self.wfile.write(f"data:{json.dumps(REFERENCE_CHUNK, ensure_ascii=False)}\n\n".encode("utf-8"))
            self.wfile.flush()
            self.wfile.write(b"data:[DONE]\n\n")
            self.wfile.flush()
            # Terminate the response body (no Content-Length / no chunked encoding here);
            # real RAGFlow ends the stream via chunked encoding termination.
            self.close_connection = True
        else:
            self._send_json({"code": 1, "message": "Not Found"}, status=404)

    def log_message(self, *args):  # silence request logging
        pass


def main():
    server = ThreadingHTTPServer((HOST, PORT), MockHandler)
    print(f"Mock RAGFlow listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
