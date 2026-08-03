# -*- coding: utf-8 -*-
"""FastAPI application entry point (equivalent to original server/src/index.ts).

- CORS: open (mirrors Express `app.use(cors())`)
- Routes: /api/auth, /api/knowledge-bases, /api/chat-assistants,
          /api/conversations, /api/chat, /api/admin, /api/health
- Global handler for ApiError → `{"code", "message"}` (legacy contract)
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import PORT
from .routers import admin, auth, chat, chat_assistant, conversations, knowledge_base
from .security import ApiError

app = FastAPI(title="ragflow-chat-server", docs_url="/docs", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})


# Public routes (no auth required)
app.include_router(auth.router, prefix="/api/auth")

# Knowledge bases & chat assistants
app.include_router(knowledge_base.router, prefix="/api/knowledge-bases")
app.include_router(chat_assistant.router, prefix="/api/chat-assistants")

# Protected routes (auth required)
app.include_router(conversations.router, prefix="/api/conversations")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(admin.router, prefix="/api/admin")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


def run() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    run()
