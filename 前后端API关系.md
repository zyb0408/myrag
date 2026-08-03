# 前后端 API 关系文档

> 本文档梳理三层调用关系：**前端（Vue 3） → BFF 后端（Express） → RAGFlow**
>
> - 前端目录：`client/`（Vue 3 + ant-design-vue，Vite dev server 端口 5173）
> - 后端目录：`server/`（Express BFF，端口 3001）
> - RAGFlow 后端：`http://localhost:9380`（配置于 `server/.env`）
>
> 前端所有请求以 `/api` 开头，由 Vite 代理转发到 `http://localhost:3001`（见 `client/vite.config.ts`）。

---

## 一、前端 → 后端（BFF）接口清单

### 1. 认证接口（`/api/auth`）—— 无需 JWT

| 方法 | 路径 | 前端调用位置 | 后端处理（server/src） | 请求体 | 响应 data |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | `client/src/stores/auth.ts` → `login()`（登录页调用） | `routes/auth.ts`：bcrypt 校验密码，签发 JWT | `{ username, password }` | `{ token, user }` |
| POST | `/api/auth/reset-password` | `client/src/stores/auth.ts` → `resetPassword()`（重置密码页调用） | `routes/auth.ts`：校验原密码，更新密码并清除 `must_reset_password` | `{ username, oldPassword, newPassword }` | `{ success: true }` |
| GET | `/api/auth/me` | `client/src/stores/auth.ts` → `checkSession()`（App 启动时调用） | `routes/auth.ts` + `middleware/auth.ts`：requireAuth，返回当前用户 | —（需 `Authorization: Bearer <token>`） | `UserInfo` |

> `user` 对象结构：`{ id, username, displayName, isAdmin, mustResetPassword }`

---

### 2. 管理员接口（`/api/admin`）—— 需 JWT + 管理员角色

| 方法 | 路径 | 前端调用位置 | 后端处理（server/src） | 请求体 | 响应 data |
|---|---|---|---|---|---|
| GET | `/api/admin/users` | `client/src/pages/AdminPage.vue` → `fetchUsers()` | `routes/admin.ts`：列出所有用户 | — | `UserInfo[]`（含 `createdAt`、`isActive`） |
| POST | `/api/admin/users` | `client/src/pages/AdminPage.vue` → `createUser()` | `routes/admin.ts`：创建用户（初始 `must_reset_password=1`） | `{ username, password, displayName }` | 新用户对象 |
| DELETE | `/api/admin/users/:id` | `client/src/pages/AdminPage.vue` → `deleteUser()` | `routes/admin.ts`：删除用户（禁删自己/最后一个管理员），级联删除其对话 | — | `{ success: true }` |
| PATCH | `/api/admin/users/:id/reset-password` | `client/src/pages/AdminPage.vue` → `resetUserPassword()` | `routes/admin.ts`：管理员重置密码，置 `must_reset_password=1` | `{ newPassword }` | `{ success: true }` |

> 鉴权链：`requireAuth`（JWT 校验）→ `requireAdmin`（`isAdmin` 校验），见 `middleware/auth.ts`。

---

### 3. 知识库与助手接口

| 方法 | 路径 | 前端调用位置 | 后端处理 | 说明 |
|---|---|---|---|---|
| GET | `/api/knowledge-bases` | `client/src/services/api.ts` → `getKnowledgeBases()`（由 `stores/app.ts` 的 `fetchKnowledgeBases` 引用，**当前 UI 未直接调用，保留能力**） | `routes/knowledgeBase.ts`：转发 RAGFlow `/api/v1/datasets` | 知识库列表 |
| GET | `/api/chat-assistants` | `client/src/services/api.ts` → `getChatAssistants()`，由 `stores/app.ts` 的 `fetchChatAssistants()` 调用（ChatPage 挂载时触发） | `server/src/index.ts` 内联路由：转发 RAGFlow `/api/v1/chats` | 聊天助手列表（侧边栏知识库选择器数据源） |

---

### 4. 对话接口（`/api/conversations`）—— 需 JWT

| 方法 | 路径 | 前端调用位置 | 后端处理（server/src/routes/conversation.ts） | 请求体/参数 | 响应 data |
|---|---|---|---|---|---|
| GET | `/api/conversations?kb_id=xxx` | `client/src/services/api.ts` → `getConversations(kbId?)`（`stores/chat.ts` 的 `fetchConversations`） | 按 `kb_id` + 当前用户列出对话（无 kb_id 则列出全部） | query: `kb_id`（可选） | `Conversation[]` |
| POST | `/api/conversations` | `client/src/services/api.ts` → `createConversation()`（Sidebar「新建对话」） | 创建对话（名称为"新对话"或自定义） | `{ name?, assistant_id, kb_id, kb_name }` | `Conversation` |
| PATCH | `/api/conversations/:id` | `client/src/services/api.ts` → `renameConversation()`（对话项「重命名」） | 重命名对话 | `{ name }` | `Conversation` |
| DELETE | `/api/conversations/:id` | `client/src/services/api.ts` → `deleteConversation()`（对话项「删除」） | 删除对话 | — | `true` |
| GET | `/api/conversations/:id/messages` | `client/src/services/api.ts` → `getMessages()`（`stores/chat.ts` 的 `fetchMessages`，选择对话时调用） | 校验对话归属后返回消息 | — | `Message[]` |

---

### 5. 聊天流式接口（`/api/chat`）—— 需 JWT

| 方法 | 路径 | 前端调用位置 | 后端处理（server/src/routes/chat.ts） | 请求体 | 响应 |
|---|---|---|---|---|---|
| POST | `/api/chat/:convId` | `client/src/services/sse.ts` → `streamChat()`（ChatWindow 发送消息时调用，**SSE 流式**） | 保存用户消息 → 拉取历史 → 调用 RAGFlow `chatCompletion(stream=true)` → 逐块转发 SSE | `{ content }` | `text/event-stream`，事件格式 `data: {json}` / `data: [DONE]` / `data: {"error":...}` |
| POST | `/api/chat/:convId/stop` | **前端未使用**（后端占位实现） | 返回 `{ stopped: true }` | — | — |

> SSE 数据格式（`client/src/services/sse.ts` 解析）：每条 `data:` 行包含 OpenAI 兼容的 `choices[0].delta.content`；`[DONE]` 表示结束；`{"error": ...}` 表示出错。

---

### 6. 其他

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查，前端未调用 |

---

## 二、后端（BFF） → RAGFlow 接口清单

RAGFlow 服务封装于 `server/src/services/ragflow.ts`（类 `RAGFlowService`），统一请求头：

```http
Authorization: Bearer <RAGFLOW_API_KEY>   # 来自 server/.env
Content-Type: application/json
```

| 方法 | RAGFlow 路径 | 封装方法 | 由哪个后端接口触发 | 说明 |
|---|---|---|---|---|
| GET | `/api/v1/datasets?page=1&page_size=100` | `getKnowledgeBases()` | `GET /api/knowledge-bases` | 知识库列表（分页取前 100） |
| GET | `/api/v1/chats` | `getChatAssistants()` | `GET /api/chat-assistants` | 聊天助手列表 |
| GET | `/api/v1/chats/:id` | `getChatAssistant(id)` | **当前无路由调用，保留方法** | 单个助手详情 |
| POST | `/api/v1/openai/:assistantId/chat/completions` | `chatCompletion(assistantId, messages, stream)` | `POST /api/chat/:convId` | OpenAI 兼容的流式对话补全（`model: "model"`，`stream: true`），响应体以 SSE 流式返回 |

> 说明：
> - `chatCompletion` 直接返回 RAGFlow 的原始 `fetch Response`，由 `routes/chat.ts` 读取流并逐块转发给前端。
> - RAGFlow 的流式响应与前端 `services/sse.ts` 的解析格式完全对齐（`choices[0].delta.content` / `[DONE]`）。

---

## 三、数据流总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                            浏览器（Vue 3 前端）                       │
│  pages/ components/   stores (pinia)   services/                     │
│  ├─ LoginPage        → authStore.login → fetch POST /api/auth/login  │
│  ├─ ResetPasswordPage→ authStore.resetPassword → POST /api/auth/...  │
│  ├─ ChatPage         → appStore.fetchChatAssistants → GET /api/...   │
│  ├─ Sidebar          → chatStore.fetchConversations → GET /api/...   │
│  ├─ ChatWindow       → sse.streamChat → POST /api/chat/:convId (SSE) │
│  └─ AdminPage        → 直接 fetch /api/admin/*                       │
└──────────────┬───────────────────────────────────────────────────────┘
               │  Vite 代理：/api → http://localhost:3001
┌──────────────▼───────────────────────────────────────────────────────┐
│                    BFF 后端（Express, 端口 3001）                     │
│  routes/auth.ts / admin.ts / conversation.ts / chat.ts               │
│  middleware/auth.ts（JWT 校验 + 管理员校验）                          │
│  db/index.ts（SQLite：users / conversations / messages）             │
└──────────────┬───────────────────────────────────────────────────────┘
               │  RAGFlowService（services/ragflow.ts）
               │  Authorization: Bearer <apiKey>
┌──────────────▼───────────────────────────────────────────────────────┐
│                    RAGFlow（http://localhost:9380）                   │
│  /api/v1/datasets  /api/v1/chats  /api/v1/openai/:id/chat/completions│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 四、鉴权机制说明

1. **登录**：`POST /api/auth/login` 校验通过后签发 JWT（有效期 7 天，`JWT_SECRET` 配置于 `server/.env`）。
2. **存储**：前端将 token 存于 `localStorage`（key: `ragflow_chat_token`），所有请求头携带 `Authorization: Bearer <token>`（见 `services/api.ts` 的 `getToken()`）。
3. **会话恢复**：前端启动时 `authStore.checkSession()` → `GET /api/auth/me` 校验 token 有效性并恢复用户信息。
4. **权限分级**：
   - 普通接口：`requireAuth`（401 未登录 / token 过期）
   - 管理员接口：`requireAuth` + `requireAdmin`（403 非管理员）
5. **RAGFlow 鉴权**：后端使用 `RAGFLOW_API_KEY`（Bearer）访问 RAGFlow，前端不直接接触 RAGFlow。

---

## 五、典型业务流程示例

### 登录 → 进入首页 → 发送消息

```
1. 前端 POST /api/auth/login                 → 后端校验 → 返回 { token, user }
2. 前端 GET  /api/auth/me (Bearer token)     → 后端校验 JWT → 返回 user
3. 前端 GET  /api/chat-assistants            → 后端转发 RAGFlow /api/v1/chats → 助手列表
4. 用户选择助手后
5. 前端 GET  /api/conversations?kb_id=xxx    → 后端查 SQLite → 对话列表
6. 用户新建/选择对话
7. 前端 POST /api/chat/:convId (SSE)         → 后端保存消息 + 调用 RAGFlow 流式对话
                                              → 逐块转发 SSE → 前端流式渲染
```

### 管理员创建用户 → 新用户登录强制改密

```
1. 管理员 GET  /api/admin/users              → 用户列表
2. 管理员 POST /api/admin/users              → 创建用户（must_reset_password=1）
3. 新用户 POST /api/auth/login               → 登录成功但 mustResetPassword=true
4. 前端跳转 /reset-password
5. 新用户 POST /api/auth/reset-password      → 修改密码，must_reset_password=0
6. 前端进入首页正常使用
```
