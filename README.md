# RAGFlow 知识库问答系统

基于 [RAGFlow](https://ragflow.io) 搭建的企业内部知识库 Web 问答系统。提供一个简洁的聊天式交互界面，支持多知识库切换、多轮对话、新建/管理对话等功能。

## 功能特性

- **知识库选择** — 从 RAGFlow 已配置的 Chat Assistant 中选择要问答的知识库
- **多轮对话** — 自动注入完整对话历史，保持上下文连贯的问答体验
- **对话管理** — 支持新建对话、重命名、删除，对话历史本地持久化
- **流式输出** — 基于 SSE 的打字机效果，实时渲染 AI 回复
- **Markdown 渲染** — AI 回复中的代码块、表格、列表等自动渲染

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户浏览器                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │             React SPA (Vite + TypeScript)          │  │
│  │  ┌──────────┐  ┌──────────────────────────────┐   │  │
│  │  │ Sidebar  │  │          Chat Area           │   │  │
│  │  │          │  │  消息列表 (用户 ↔ AI 气泡)     │   │  │
│  │  │ 知识库选择 │  │  流式打字机效果               │   │  │
│  │  │ 对话列表  │  │  输入框 + 发送按钮             │   │  │
│  │  └──────────┘  └──────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/SSE (localhost:5173)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              BFF 代理层 (Express + TypeScript)            │
│                                                         │
│  /api/knowledge-bases    →  知识库列表                    │
│  /api/chat-assistants    →  Chat Assistant 列表          │
│  /api/conversations      →  对话 CRUD (SQLite)           │
│  /api/chat/:id           →  发送消息 (SSE 流式透传)       │
│                                                         │
│  SQLite: conversations + messages 表                     │
└──────────────────────┬──────────────────────────────────┘
                       │ Bearer Token (localhost:9380)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  RAGFlow 服务（已有）                      │
│                                                         │
│  GET  /api/v1/datasets         → 知识库列表              │
│  GET  /api/v1/chats            → Chat Assistant 列表     │
│  POST /api/v1/openai/{id}/chat/completions → 对话补全    │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入 → React → BFF (保存到 SQLite) → RAGFlow API (SSE)
                                               ↓
用户看到 ← React ← BFF (SSE 透传 + 缓存全文) ←──┘
                                               ↓
                              流结束后 BFF 将完整回复写入 SQLite
```

### 架构决策

| 决策 | 说明 |
|------|------|
| 引入 BFF 代理层 | API Key 不暴露到浏览器；消息历史统一持久化 |
| SQLite 存储对话 | 零配置、嵌入式，无需额外数据库服务 |
| SSE 透传 | BFF 直转 RAGFlow 的 SSE 流，既保证安全又不增加延迟 |
| Vite 开发代理 | 前端 `/api` 请求自动转发到 BFF，避免跨域问题 |
| Zustand 状态管理 | 轻量级，TypeScript 友好，比 Redux 更简洁 |

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | UI 构建 |
| 构建工具 | Vite 6 | 开发服务器 & 构建 |
| UI 组件 | Ant Design 5 | 界面组件 |
| 图标 | @ant-design/icons | 图标库 |
| Markdown | react-markdown | AI 回复渲染 |
| 状态管理 | Zustand 5 | 全局状态 |
| 后端框架 | Express 4 | HTTP 服务 |
| 数据库 | better-sqlite3 | 对话 & 消息存储 |
| 配置管理 | dotenv | 环境变量 |
| 并发启动 | concurrently | 同时启动前后端 |

## 项目结构

```
knowlege-new/
├── client/                             # 前端
│   ├── src/
│   │   ├── main.tsx                    # 入口
│   │   ├── App.tsx                     # Ant Design 配置 & 路由
│   │   ├── App.css                     # 全局样式 & Markdown 样式
│   │   ├── pages/
│   │   │   └── ChatPage.tsx            # 主页面 — 组装 Sidebar + ChatWindow
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├─�� MainLayout.tsx      # 左右分栏布局
│   │   │   │   └── Sidebar.tsx         # 侧边栏容器
│   │   │   ├── knowledge-base/
│   │   │   │   └── KBSelector.tsx      # 知识库下拉选择器
│   │   │   ├── conversation/
│   │   │   │   ├── ConversationList.tsx # 对话列表
│   │   │   │   └── ConversationItem.tsx # 单条对话（操作菜单）
│   │   │   └── chat/
│   │   │       ├── ChatWindow.tsx       # 聊天主窗口（组装）
│   │   │       ├── ChatHeader.tsx       # 聊天头部（名称 & 知识库）
│   │   │       ├── MessageList.tsx      # 消息列表 + 自动滚底
│   │   │       ├── MessageBubble.tsx    # 消息气泡 + Markdown 渲染
│   │   │       └── ChatInput.tsx        # 输入框组件
│   │   ├── stores/
│   │   │   ├── appStore.ts             # 全局状态：知识库列表、选中 Assistant
│   │   │   └── chatStore.ts            # 聊天状态：对话列表、消息、流式缓存
│   │   ├── services/
│   │   │   ├── api.ts                  # REST API 封装
│   │   │   └── sse.ts                  # SSE 流式接收处理
│   │   └── types/
│   │       └── index.ts                # TypeScript 类型定义
│   ├── index.html
│   ├── vite.config.ts                  # Vite 配置（含 /api 代理）
│   └── package.json
├── server/                             # 后端 BFF
│   ├── src/
│   │   ├── index.ts                    # Express 入口 & 路由注册
│   │   ├── config.ts                   # 环境变量配置
│   │   ├── routes/
│   │   │   ├── knowledgeBase.ts        # GET /api/knowledge-bases
│   │   │   ├── conversation.ts         # 对话 CRUD
│   │   │   └── chat.ts                 # POST /api/chat/:convId (SSE)
│   │   ├── services/
│   │   │   ├── ragflow.ts              # RAGFlow API 封装
│   │   │   └── sse.ts                  # SSE 流处理
│   │   ├── db/
│   │   │   ├── index.ts               # SQLite 初始化 & 查询工具函数
│   │   │   └── schema.ts              # 建表语句
│   │   └── types/
│   │       └── index.ts               # 类型定义
│   ├── data/                           # SQLite 数据文件目录（自动创建）
│   ├── .env                            # 环境变量
│   └── package.json
└── package.json                        # 根脚本（npm run dev 同时启动前后端）
```

## 环境要求

- **Node.js** >= 18
- **npm** >= 9
- 已部署可访问的 **RAGFlow** 服务（版本 >= 0.24.0，需支持 OpenAI 兼容 API）
- 在 RAGFlow 中已创建并配置好 **Chat Assistant**（绑定知识库、模型等）

## 配置

编辑 `server/.env`：

```env
# RAGFlow 服务地址
RAGFLOW_BASE_URL=http://your-ragflow-host:9380

# RAGFlow API Key（在 RAGFlow 控制台 → 设置 → API Key 中获取）
RAGFLOW_API_KEY=ragflow-your-api-key-here

# BFF 服务端口（可选，默认 3001）
BFF_PORT=3001
```

> **获取 API Key**：登录 RAGFlow 控制台 → 右上角设置 → API Key → 创建新 Key，复制以 `ragflow-` 开头的 key。

## 安装 & 启动

```bash
# 1. 安装所有依赖
npm run install:all

# 2. 启动开发环境（同时启动前端 + 后端）
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:3001
```

生产构建：

```bash
# 构建前端
cd client && npm run build

# 产物在 client/dist/，可直接部署到静态服务器

# 后端启动
cd server && npm run build && npm start
```

## API 接口

所有接口以 `/api` 为前缀，BFF 层透传请求到 RAGFlow。

### 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/knowledge-bases` | 获取知识库列表（来自 RAGFlow datasets） |

### Chat Assistant

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/chat-assistants` | 获取已配置的 Chat Assistant 列表 |

### 对话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/conversations?kb_id=xxx` | 获取指定知识库下的对话列表 |
| `POST` | `/api/conversations` | 新建对话 |
| `PATCH` | `/api/conversations/:id` | 重命名对话 |
| `DELETE` | `/api/conversations/:id` | 删除对话（级联删除消息） |
| `GET` | `/api/conversations/:id/messages` | 获取对话的消息历史 |

**POST /api/conversations 请求体：**

```json
{
  "name": "对话名称（可选，不传则自动生成）",
  "assistant_id": "RAGFlow Chat Assistant ID",
  "kb_id": "知识库 ID",
  "kb_name": "知识库名称"
}
```

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat/:convId` | 发送消息，返回 SSE 流式响应 |

**POST /api/chat/:convId 请求体：**

```json
{
  "content": "用户问题"
}
```

**SSE 响应格式：**

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"您好"}}],"model":"model","object":"chat.completion.chunk"}
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"，请问"}}],"model":"model","object":"chat.completion.chunk"}
data: [DONE]
```

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 返回 `{"status":"ok"}` |

## 数据库设计

### conversations 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (PK) | UUID |
| name | TEXT | 对话名称 |
| assistant_id | TEXT | RAGFlow Chat Assistant ID |
| kb_id | TEXT | 知识库 ID |
| kb_name | TEXT | 知识库名称 |
| created_at | TEXT | 创建时间 (ISO 8601) |
| updated_at | TEXT | 更新时间 (ISO 8601) |

### messages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (PK) | UUID |
| conversation_id | TEXT (FK) | 关联对话 ID，级联删除 |
| role | TEXT | `user` 或 `assistant` |
| content | TEXT | 消息内容 |
| references | TEXT (JSON) | 引用来源（预留） |
| created_at | TEXT | 创建时间 (ISO 8601) |

## 使用说明

1. 确保 RAGFlow 服务已启动且可访问
2. 在 `server/.env` 中配置 RAGFlow 地址和 API Key
3. 运行 `npm run dev` 启动系统
4. 浏览器打开 `http://localhost:5173`
5. 在左侧下拉框中选择一个知识库（Chat Assistant）
6. 点击「新建对话」开始问答
7. 在输入框中输入问题，按 Enter 发送
8. 右侧对话框会实时显示 AI 回复

## 开发说明

### 前端代理

开发模式下，Vite 自动将 `/api` 请求代理到 BFF 服务（`localhost:3001`），无需额外配置。

### BFF 数据存储

对话和消息存储在 `server/data/ragflow-chat.db`（SQLite），项目重启后数据不丢失。

### Node 版本管理

项目根目录的 `package.json` 使用 `concurrently` 同时启动前后端。如果使用 nvm 或 fnm，确保 Node.js >= 18。

## License

MIT
