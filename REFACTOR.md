# 后端重构方案：TypeScript (Express) → Python 3.10 (FastAPI)

> 分支：`feature/python-bff-rewrite`（基于 `refactor/vue3`）
> 范围：仅重写 `server/` 后端 BFF 层；**前端 `client/` 代码零改动**
> 状态：方案文档（先行）→ 代码实施（随后）→ 联调验证（最后）

---

## 一、背景与目标

当前后端为 Node.js/TypeScript（Express + better-sqlite3 + bcryptjs + jsonwebtoken），
作为 BFF 层对外提供 REST 接口（端口 3001），对内对接 RAGFlow（`http://localhost:9380`）。

本次目标：

1. **以 Python 3.10 重写全部后端代码**，包括 BFF 层与 RAGFlow 的 API 对接；
2. RAGFlow 对接方式以官方文档
   [Python API Reference](https://ragflow.io/docs/python_api_reference) 为准，
   调用路径、请求参数与返回格式保持一致；
3. **接口契约完全不变**：接口路径、请求方法、请求参数、响应结构与字段含义，
   保证前端无需任何改动即可正常对接；
4. 使用 **uv** 管理虚拟环境与依赖，锁定 **Python 3.10** 版本；
5. 业务逻辑不改变，仅一处明确缺陷修复（见"七、行为差异说明"）。

---

## 二、技术选型

| 关注点 | 旧实现 (TS) | 新实现 (Python) | 说明 |
|---|---|---|---|
| Web 框架 | Express 4 | **FastAPI + uvicorn** | 原生支持异步与 SSE；自动生成 /docs |
| 数据库 | better-sqlite3 | **标准库 `sqlite3`** | 复用同一 db 文件，零外部依赖 |
| 密码哈希 | bcryptjs | **bcrypt** (PyPI) | hash 格式 `$2a$/$2b$` 互通，兼容已有数据 |
| JWT | jsonwebtoken | **PyJWT** | 算法 HS256，payload 字段保持一致 |
| HTTP 客户端 | 内置 fetch | **httpx** | 异步流式读取 RAGFlow SSE |
| 环境变量 | dotenv | **python-dotenv** | 读取 `server/.env` |
| 依赖/虚拟环境 | npm | **uv** | `pyproject.toml` + `uv.lock`，锁定 Python 3.10 |

Python 版本约束：`requires-python = ">=3.10,<3.11"`，由 uv 自动下载/使用 3.10 解释器。

---

## 三、模块划分（新旧对照）

### 旧目录结构（将被删除）

```
server/
├── package.json / package-lock.json / tsconfig.json
├── src/
│   ├── index.ts                  # 应用入口（含 /api/chat-assistants 内联路由）
│   ├── config.ts                 # 环境配置
│   ├── db/{index,schema}.ts      # SQLite 封装 + 建表/迁移/种子
│   ├── middleware/auth.ts        # JWT 签发/校验 + requireAuth/requireAdmin
│   ├── routes/{auth,admin,conversation,chat,knowledgeBase}.ts
│   ├── services/ragflow.ts       # RAGFlow 客户端
│   └── types/index.ts            # TS 类型定义
└── data/ragflow-chat.db          # ★ 保留（运行时数据）
```

### 新目录结构

```
server/
├── pyproject.toml                # uv 项目定义（锁 Python 3.10）
├── uv.lock                       # uv 锁定文件
├── .env                          # ★ 保留（运行时密钥配置，git 忽略）
├── .env.example                  # 新增：环境变量样例
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI 入口：CORS、路由注册、/api/health
│   ├── config.py                 # 环境配置（等价 config.ts）
│   ├── db.py                     # SQLite：连接/WAL/建表/迁移/种子（等价 db/index.ts + schema.ts）
│   ├── security.py               # JWT + bcrypt + requireAuth/requireAdmin 依赖
│   ├── ragflow.py                # RAGFlow 客户端（httpx 异步，等价 services/ragflow.ts）
│   └── routers/
│       ├── __init__.py
│       ├── auth.py               # /api/auth/*        （等价 routes/auth.ts）
│       ├── admin.py              # /api/admin/*       （等价 routes/admin.ts）
│       ├── conversations.py      # /api/conversations*（等价 routes/conversation.ts）
│       ├── chat.py               # /api/chat/*        （等价 routes/chat.ts）
│       ├── knowledge_base.py     # /api/knowledge-bases（等价 routes/knowledgeBase.ts）
│       └── chat_assistant.py     # /api/chat-assistants（原 index.ts 内联路由独立成模块）
└── data/ragflow-chat.db          # ★ 保留（复用，零迁移成本）
```

---

## 四、接口契约清单（必须逐字保持，前端零改动）

统一响应包装：成功 `{ code: 0, data }`；业务失败 `{ code: 1, message }`；
认证失败 `{ code: 401|403, message }`（HTTP 状态码同步为 401/403）。

### 4.1 认证 `/api/auth`（无需 JWT）

| 方法 | 路径 | 请求体/参数 | 响应 data | 关键错误 |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{username, password}` | `{token, user:{id,username,displayName,isAdmin,mustResetPassword}}` | 400 参数缺失；401 用户名或密码错误；403 账号已被禁用 |
| POST | `/api/auth/reset-password` | `{username, oldPassword, newPassword}` | `{success:true}` | 400 参数不完整/新密码至少 6 位；404 用户不存在；401 原密码错误 |
| GET | `/api/auth/me` | Bearer token | `UserInfo` | 401 未登录/登录已过期；404 用户不存在 |

### 4.2 管理员 `/api/admin`（requireAuth + requireAdmin）

| 方法 | 路径 | 请求体/参数 | 响应 data | 关键错误 |
|---|---|---|---|---|
| GET | `/api/admin/users` | — | `UserInfo[]`（含 `createdAt`、`isActive`） | 403 仅管理员可操作 |
| POST | `/api/admin/users` | `{username, password, displayName}` | 新用户对象 | 400 参数/密码长度/用户名已存在 |
| DELETE | `/api/admin/users/:id` | — | `{success:true}` | 400 不能删除自己/不能删除最后一个管理员 |
| PATCH | `/api/admin/users/:id/reset-password` | `{newPassword}` | `{success:true}` | 400 新密码至少 6 位 |

### 4.3 知识库与助手（无需 JWT）

| 方法 | 路径 | 响应 data |
|---|---|---|
| GET | `/api/knowledge-bases` | RAGFlow `/api/v1/datasets?page=1&page_size=100` 的 `data` 原样透传 |
| GET | `/api/chat-assistants` | RAGFlow `/api/v1/chats` 的 `data` 原样透传 |

### 4.4 对话 `/api/conversations`（requireAuth）

| 方法 | 路径 | 请求体/参数 | 响应 data |
|---|---|---|---|
| GET | `/api/conversations` | query `kb_id?` | `Conversation[]`（含 `user_id`，按 `updated_at DESC`） |
| POST | `/api/conversations` | `{name?, assistant_id, kb_id, kb_name}` | `Conversation`（默认名 `新对话 <zh-CN 时间>`） |
| PATCH | `/api/conversations/:id` | `{name}` | `Conversation` |
| DELETE | `/api/conversations/:id` | — | `true` |
| GET | `/api/conversations/:id/messages` | — | `Message[]`（按 `created_at ASC`） |

### 4.5 聊天 `/api/chat`（requireAuth）

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| POST | `/api/chat/:convId` | `{content}` | SSE：`data: {json}` → `data: [DONE]`；异常 `data: {"error":...}` |
| POST | `/api/chat/:convId/stop` | — | `{code:0, data:{stopped:true}}` |

SSE 转发格式（与前端 `services/sse.ts` 解析完全一致）：
- 透传 RAGFlow 每条 `data: {json}`（`choices[0].delta.content` 为增量文本）；
- 结束发送 `data: [DONE]`；RAGFlow 错误时发送 `data: {"error":"..."}`。

### 4.6 其他

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/health` | `{status:'ok'}` |

---

## 五、RAGFlow 对接方案（以官方 Python API Reference 为准）

官方文档确认的 REST 端点（SDK 底层即这些 HTTP API），BFF 用 httpx 直连，保持调用路径/参数/返回格式与官方一致：

| 用途 | 端点 | 参数 | 返回 |
|---|---|---|---|
| 知识库列表 | `GET /api/v1/datasets` | `page=1&page_size=100` | `{code, data:[dataset]}` |
| 助手列表 | `GET /api/v1/chats` | — | `{code, data:[chat]}` |
| 助手详情 | `GET /api/v1/chats/{id}` | — | `{code, data:chat}` |
| 流式对话 | `POST /api/v1/openai/{chat_id}/chat/completions` | `{model:"model", messages, stream:true}` | OpenAI 兼容 SSE 流 |

统一请求头：`Authorization: Bearer <RAGFLOW_API_KEY>`、`Content-Type: application/json`。

- 对话 `model` 沿用助手配置（占位符 `"model"`），`messages` 为 `[{role, content}]` 历史消息数组（≥1 条 user 消息）；
- 流式响应按行解析 `data:` 事件，增量内容取自 `choices[0].delta.content`；
- 非 2xx 时错误消息取 `data.message || data.msg || statusText`，`code !== 0` 时按旧逻辑抛错。

---

## 六、改动范围

### 删除（git 跟踪，直接删除）

- `server/src/`（全部 TS 源码）
- `server/package.json`、`server/package-lock.json`、`server/tsconfig.json`
- `server/node_modules/`（git 忽略，一并清理）
- 根目录 `package.json` 中 `dev:server` 脚本改为 uv 启动方式（`client/` 与 `dev:client` 不动）

### 新增

- `server/pyproject.toml`、`server/uv.lock`
- `server/app/**`（Python 源码）
- `server/.env.example`
- 根目录 `REFACTOR.md`（本文档）、`README.md`（新）

### 保留（不删不改）

- `client/` 全部前端代码
- `server/.env`（运行时密钥/配置，git 忽略）
- `server/data/ragflow-chat.db`（SQLite 数据，git 忽略，Python 复用同路径）

---

## 七、行为差异说明

**唯一差异（缺陷修复）**：旧版 `routes/chat.ts` 在流式结束保存助手消息时，
`execute(...)` 调用缺少参数数组（`better-sqlite3` 参数不匹配），导致每次对话
助手回复**永不落库**，且前端在收到完整流后会额外收到一条 `data: {"error":...}` 事件。

本次重写按原有意图修复：正确写入 `messages` 表（`role='assistant'`），
不再发送错误的 error 事件。**接口路径/方法/参数/响应结构/字段含义均未改变**，
前端 `sse.ts` 的解析逻辑无需任何调整；错误路径（RAGFlow 异常）仍会发送
`data: {"error":...}`，契约不变。

---

## 八、验证方案

1. 单元级：启动 Python 后端，逐项请求 4.1~4.6 全部端点（正常路径 + 错误路径），
   断言 HTTP 状态码、`code`、`data` 结构与旧实现一致；
2. 对接级：因本机 RAGFlow 服务未运行，启动临时 Mock 服务（Python，模拟
   `/api/v1/datasets`、`/api/v1/chats`、`/api/v1/openai/{id}/chat/completions` SSE），
   验证 BFF 的 RAGFlow 对接与 SSE 透传行为；
3. 前端契约级：比对 `client/src/services/api.ts`、`services/sse.ts` 的解析方式，
   确认新响应与之逐字段匹配；
4. 联调结果输出为 `docs/联调验证结果.md`（覆盖接口、测试用例、通过情况）。

---

## 九、实施顺序

1. ✅ 本方案文档
2. 搭建 uv 项目骨架（pyproject.toml，锁 Python 3.10）
3. 实现 app 模块（config → db → security → ragflow → routers → main）
4. 删除旧 TS 实现与 npm 配置
5. 编写新 README.md
6. 联调验证并输出结果文档
