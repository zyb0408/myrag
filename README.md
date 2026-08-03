# RAGFlow 知识问答系统（Knowledge QA）

基于 **RAGFlow** 的知识问答平台：前端 Vue 3 + ant-design-vue，后端 **Python 3.10 (FastAPI)** BFF
服务层，三层架构：**浏览器 → BFF 后端 → RAGFlow**。

- 前端目录：`client/`（Vue 3 + Vite，dev 端口 5173，**本仓库重构未改动任何前端文件**）
- 后端目录：`server/`（Python 3.10 + FastAPI BFF，端口 3001，本次由 TypeScript 重写而来）
- RAGFlow 服务：默认 `http://localhost:9380`

> 本次分支 `feature/python-bff-rewrite` 将后端从 Node.js/TypeScript（Express）整体重写为
> Python 3.10（FastAPI），**接口契约 100% 保持不变**，前端零改动即可对接。
> 详见 [REFACTOR.md](./REFACTOR.md) 重构文档。

---

## 一、项目简介

系统提供以下能力：

1. **用户认证**：登录、重置密码、会话恢复（JWT，7 天有效期）；
2. **权限管理**：普通用户 / 管理员两级角色，管理员可管理用户（创建、删除、重置密码）；
3. **知识库与助手**：透传 RAGFlow 的知识库（dataset）列表与聊天助手（chat）列表；
4. **对话管理**：本地 SQLite 持久化对话与消息（按用户隔离）；
5. **流式问答**：通过 BFF 调用 RAGFlow 的 OpenAI 兼容接口，以 SSE 流式转发到前端。

架构总览：

```
浏览器 (Vue 3, :5173)
   │  /api → Vite 代理 → http://localhost:3001
   ▼
BFF 后端 (Python 3.10 FastAPI, :3001)
   ├─ SQLite (server/data/ragflow-chat.db)：users / conversations / messages
   └─ httpx → RAGFlow (http://localhost:9380)
        /api/v1/datasets
        /api/v1/chats
        /api/v1/openai/{chat_id}/chat/completions (SSE)
```

---

## 二、Python 版本要求

- **Python 3.10.x（唯一受支持版本）**
- 依赖与虚拟环境由 [uv](https://docs.astral.sh/uv/) 管理，`pyproject.toml` 中声明
  `requires-python = ">=3.10,<3.11"`；若本机无 3.10 解释器，uv 会自动下载安装。

检查 uv：

```bash
uv --version
# 未安装时：curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## 三、环境准备与依赖安装

```bash
# 1. 进入后端目录
cd server

# 2. 创建虚拟环境并安装依赖（生成 .venv 与 uv.lock，自动锁定 Python 3.10）
uv sync

# 3. 启动前准备环境变量
cp .env.example .env   # 然后按需编辑（见下节）
```

> 前端依赖（仅前端开发需要）：`cd client && npm install`。
> 根目录亦可一键执行 `npm run install:all`（等价上面两条）。

---

## 四、配置说明（密钥、环境变量）

配置文件：`server/.env`（git 忽略，不提交仓库；`server/.env.example` 为样例模板）。

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `RAGFLOW_BASE_URL` | 是 | `http://localhost:9380` | RAGFlow 服务地址（含端口） |
| `RAGFLOW_API_KEY` | 是 | 空 | RAGFlow API Key（RAGFlow 平台生成，Bearer 方式传递） |
| `BFF_PORT` | 否 | `3001` | BFF 服务监听端口（前端 Vite 代理指向此端口） |
| `JWT_SECRET` | 否 | 内置默认值 | JWT 签名密钥，**生产环境必须改为强随机值** |

安全说明：

- `RAGFLOW_API_KEY` 仅存于后端，前端不接触 RAGFlow；
- `JWT_SECRET` 泄漏将导致任意伪造登录态，生产环境务必更换；
- 首次启动会在空库中自动创建默认管理员：`admin / admin123`（登录后建议立即改密）。

---

## 五、启动与运行方式

### 方式一：分别启动（推荐开发）

```bash
# 后端 BFF（端口 3001）
cd server && uv run uvicorn app.main:app --host 0.0.0.0 --port 3001

# 前端（端口 5173，另开终端）
cd client && npm run dev
```

### 方式二：根目录一键启动

```bash
npm run dev        # 并发启动前后端（dev:server 用 uv，dev:client 用 Vite）
```

### 健康检查与接口文档

```bash
curl http://localhost:3001/api/health     # → {"status":"ok"}
```

- Swagger 文档：<http://localhost:3001/docs>
- OpenAPI JSON：<http://localhost:3001/openapi.json>

> 运行前提：RAGFlow 服务已启动且 `RAGFLOW_API_KEY` 有效；
> 知识库/助手列表与流式问答依赖 RAGFlow 可用。

---

## 五·补 Windows 10 运行说明

**结论：可以直接在 Windows 10 上运行**。BFF 后端（Python 3.10）与前端（Vue 3/Vite）
均为跨平台实现；唯一需要额外准备的是 **RAGFlow 服务本身**（见下文注意事项）。

### 前置软件

| 软件 | 版本 | 安装方式（Windows） |
|---|---|---|
| uv | 最新 | `winget install astral-sh.uv` 或 <https://docs.astral.sh/uv/getting-started/installation/>（uv 会自动下载 Python 3.10，**无需手动装 Python**） |
| Node.js | **LTS 20 / 22**（Vite 6 要求 Node ^18 \|\| ^20 \|\| >=22） | <https://nodejs.org/> 下载 LTS 安装包 |
| Git（可选） | 最新 | <https://git-scm.com/> |

### 安装与启动（PowerShell）

```powershell
# 1. 后端依赖（自动下载 Python 3.10 + 依赖，生成 .venv 与 uv.lock）
cd server
uv sync

# 2. 配置环境变量
copy .env.example .env        # 然后编辑 .env，填入 RAGFLOW_API_KEY 等

# 3. 启动后端 BFF（端口 3001）
uv run uvicorn app.main:app --host 0.0.0.0 --port 3001

# 4. 另开一个终端，启动前端（端口 5173）
cd client
npm install
npm run dev
```

浏览器访问 <http://localhost:5173> 即可。

### 注意事项

1. **RAGFlow 服务**：RAGFlow 官方不支持 Windows 原生运行，需任选其一：
   - 本机安装 **Docker Desktop（WSL2 后端）** 后按 RAGFlow 官方文档用 Docker 部署；
   - 或使用局域网/云服务器上已有的 RAGFlow，把 `server/.env` 的
     `RAGFLOW_BASE_URL` 指向其地址（如 `http://192.168.x.x:9380`）即可，本项目无需其他改动。
2. **PowerShell 版本**：Windows PowerShell 5.1 不支持 `&&` 连接命令，请分行执行或使用
   PowerShell 7+ / Git Bash。
3. **中文乱码**：若控制台日志出现中文乱码，先执行 `chcp 65001`（切 UTF-8 代码页），
   或设置环境变量 `PYTHONUTF8=1`。
4. **防火墙**：仅本机访问无需处理；若需局域网内其他设备访问前端/后端，
   放行 TCP 3001 与 5173 入站规则。
5. **路径过长（可选）**：若 `npm install` 因 `node_modules` 路径过长报错，
   可启用 Windows 长路径支持（`reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1` 后重启），
   或改用 pnpm（`npm i -g pnpm && pnpm install`）。
6. **从 macOS/Linux 迁移数据库（可选）**：若沿用旧库文件，拷贝 `ragflow-chat.db` 时
   若存在同目录 `-wal`/`-shm` 文件需一并拷贝；SQLite 文件格式跨平台，Windows 直接可用。
7. `uvicorn[standard]` 在 Windows 上会自动跳过 Linux 专属的 uvloop，回退到标准 asyncio，无需处理。

---

## 六、接口文档

统一响应包装：

- 成功：`{ "code": 0, "data": ... }`
- 业务失败：`{ "code": 1, "message": "..." }`（HTTP 状态码 400/401/403/404/500 对应）
- 认证失败：`{ "code": 401|403, "message": "..." }`

### 1. 认证 `/api/auth`（无需 JWT）

| 方法 | 路径 | 请求体 | 响应 data |
|---|---|---|---|
| POST | `/api/auth/login` | `{username, password}` | `{token, user: UserInfo}` |
| POST | `/api/auth/reset-password` | `{username, oldPassword, newPassword}` | `{success: true}` |
| GET | `/api/auth/me` | `Authorization: Bearer <token>` | `UserInfo` |

`UserInfo = { id, username, displayName, isAdmin, mustResetPassword }`

### 2. 管理员 `/api/admin`（需 JWT + 管理员角色）

| 方法 | 路径 | 请求体 | 响应 data |
|---|---|---|---|
| GET | `/api/admin/users` | — | `UserInfo[]`（含 `createdAt`、`isActive`） |
| POST | `/api/admin/users` | `{username, password, displayName}` | 新用户对象 |
| DELETE | `/api/admin/users/:id` | — | `{success: true}` |
| PATCH | `/api/admin/users/:id/reset-password` | `{newPassword}` | `{success: true}` |

### 3. 知识库与助手（无需 JWT，透传 RAGFlow）

| 方法 | 路径 | 响应 data |
|---|---|---|
| GET | `/api/knowledge-bases` | RAGFlow 知识库列表（`/api/v1/datasets?page=1&page_size=100`） |
| GET | `/api/chat-assistants` | RAGFlow 聊天助手列表（`/api/v1/chats`） |

### 4. 对话 `/api/conversations`（需 JWT）

| 方法 | 路径 | 请求体/参数 | 响应 data |
|---|---|---|---|
| GET | `/api/conversations` | query `kb_id?` | `Conversation[]` |
| POST | `/api/conversations` | `{name?, assistant_id, kb_id, kb_name}` | `Conversation` |
| PATCH | `/api/conversations/:id` | `{name}` | `Conversation` |
| DELETE | `/api/conversations/:id` | — | `true` |
| GET | `/api/conversations/:id/messages` | — | `Message[]` |

`Conversation = { id, name, assistant_id, kb_id, kb_name, user_id, created_at, updated_at }`
`Message = { id, conversation_id, role, content, references, created_at }`

### 5. 聊天 `/api/chat`（需 JWT）

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| POST | `/api/chat/:convId` | `{content}` | SSE 流式（见下） |
| POST | `/api/chat/:convId/stop` | — | `{code:0, data:{stopped:true}}` |

SSE 事件格式（与前端 `client/src/services/sse.ts` 解析完全一致）：

```
data: {"choices":[{"delta":{"content":"..."}}]}   ← RAGFlow 增量文本，逐条透传
data: [DONE]                                       ← 流结束
data: {"error":"..."}                              ← 出错时发送，随后 [DONE]
```

### 6. 其他

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/health` | `{status:'ok'}` |

---

## 七、与旧实现（TypeScript/Express）的差异说明

本次重写（分支 `feature/python-bff-rewrite`）相对旧 Node.js 后端的差异：

### 技术栈

| 维度 | 旧实现 | 新实现 |
|---|---|---|
| 语言/运行时 | TypeScript / Node.js | **Python 3.10** |
| Web 框架 | Express 4 | **FastAPI + uvicorn** |
| 数据库访问 | better-sqlite3 | Python 标准库 `sqlite3`（同一 db 文件） |
| 密码哈希 | bcryptjs | bcrypt（hash 格式互通，兼容存量数据） |
| JWT | jsonwebtoken | PyJWT（HS256，payload 字段一致） |
| HTTP 客户端 | 内置 fetch | httpx（异步流式） |
| 依赖管理 | npm | **uv**（pyproject.toml + uv.lock） |

### 行为差异（仅 1 处缺陷修复，接口契约不变）

旧版 `routes/chat.ts` 在流式对话结束保存助手消息时存在参数缺失缺陷（`better-sqlite3`
参数不匹配），导致：

1. 助手回复**永不写入数据库**（历史消息中永远只有用户消息）；
2. 前端每次对话在收到完整回复后，还会额外收到一条 `data: {"error": ...}` 事件。

新实现按原意图修复：助手回复正确持久化到 `messages` 表，不再产生错误的 error 事件。
**接口路径、请求方法、请求参数、响应结构与字段含义全部保持不变**，前端无需任何改动；
RAGFlow 异常时仍按契约发送 `data: {"error": ...}`。

### 结构变化

- 后端源码由 `server/src/**/*.ts` 变为 `server/app/**/*.py`（模块划分见 REFACTOR.md）；
- 旧 npm 配置（`package.json`/`package-lock.json`/`tsconfig.json`）删除；
- 根目录 `package.json` 的 `dev:server` / `install:all` 脚本改用 uv；
- 数据库文件路径不变（`server/data/ragflow-chat.db`），存量数据零迁移直接可用；
- 环境变量名与语义不变（`RAGFLOW_BASE_URL` / `RAGFLOW_API_KEY` / `BFF_PORT` / `JWT_SECRET`）。

### 不变项（严格保持）

- 全部 REST 接口路径、方法、参数、响应结构（见上节接口文档）；
- SSE 转发格式与前端 `sse.ts` 解析逻辑；
- SQLite 表结构与 JWT/登录态语义；
- 前端 `client/` 代码零改动。

---

## 八、目录结构

```
├── client/                  # 前端（Vue 3，未改动）
├── server/                  # 后端 BFF（Python 3.10）
│   ├── pyproject.toml       # uv 项目定义（锁 Python 3.10）
│   ├── uv.lock              # 依赖锁文件
│   ├── .env / .env.example  # 环境配置
│   ├── app/
│   │   ├── main.py          # FastAPI 入口（CORS/路由/健康检查）
│   │   ├── config.py        # 环境配置
│   │   ├── db.py            # SQLite（建表/迁移/种子）
│   │   ├── security.py      # JWT + bcrypt + 鉴权依赖
│   │   ├── ragflow.py       # RAGFlow 客户端（httpx）
│   │   └── routers/         # auth / admin / conversations / chat / knowledge_base / chat_assistant
│   └── data/                # SQLite 数据文件（git 忽略）
├── REFACTOR.md              # 重构方案文档
└── README.md                # 本文档
```
