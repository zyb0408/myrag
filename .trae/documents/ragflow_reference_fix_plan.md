# RAGFlow 引用 (Reference) 显示修复计划

## 一、问题概述

### 目标
根据 RAGFlow 最新 Python API (v0.24+)，修复 BFF 层和前端的引用处理逻辑，确保知识库查询的引用（citations）能正确显示。

### 核心问题
**RAGFlow v0.24+ 的 `reference` 字段格式发生了变化**：

| 版本 | reference 格式 | 示例 |
|------|---------------|------|
| 旧版 (pre-v0.24) | **数组** `[]` | `[{"document_name": "...", "content": "..."}]` |
| v0.24+ | **对象** `{chunks: {...}, doc_aggs: {...}}` | 见下方详细结构 |

#### RAGFlow v0.24+ reference 对象结构

```json
{
  "reference": {
    "chunks": {
      "chunk_id_1": {
        "id": "chunk_unique_id",
        "content": "文档内容片段...",
        "document_id": "4bdd2ff65e1511f0907f09f583941b45",
        "document_name": "INSTALL22.md",
        "document_metadata": {"author": "bob", "year": "2023"},
        "dataset_id": "456ce60c5e1511f0907f09f583941b45",
        "similarity": 0.5697155305154673,
        "vector_similarity": 0.7323851005515574,
        "term_similarity": 0.5000000005,
        "positions": [[12, 11, 11, 11, 11]],
        "url": null,
        "doc_type": ""
      }
    },
    "doc_aggs": {
      "INSTALL22.md": {
        "doc_name": "INSTALL22.md",
        "doc_id": "4bdd2ff65e1511f09f583941b45",
        "count": 3
      }
    }
  }
}
```

---

## 二、问题分析

### 1. BFF 层问题 (`server/app/routers/chat.py`)

#### 问题 A：`_simplify_references()` 函数签名和逻辑错误

**当前代码**：
```python
def _simplify_references(refs: list) -> list:
    simplified = []
    for r in refs:  # ❌ 如果 refs 是对象，遍历的是 key（字符串），不是 chunk 对象
        if not isinstance(r, dict):
            continue
        simplified.append({
            "document_name": r.get("document_name") or r.get("docnm_kwd") or "",
            "content": r.get("content") or r.get("content_with_weight") or "",
            ...
        })
    return simplified
```

**问题**：
- 函数假设 `refs` 是数组，但 RAGFlow v0.24+ 返回的是对象
- 当传入对象时，`for r in refs` 遍历的是字典 key（如 `"20"`, `"21"` 等 chunk_id 字符串），导致无法正确提取字段

#### 问题 B：引用提取逻辑不完整

**当前代码**：
```python
ref_raw = delta.get("reference")
if not isinstance(ref_raw, list) or not ref_raw:
    ref_raw = parsed.get("reference")
if isinstance(ref_raw, list) and ref_raw:  # ❌ 只检查 list，不检查对象
    references = _simplify_references(ref_raw)
```

**问题**：
- 代码只检查 `ref_raw` 是否为 `list`，但 RAGFlow v0.24+ 返回的是 `dict`
- 即使 `ref_raw` 是正确的对象，也会因为 `isinstance(ref_raw, list)` 检查失败而被跳过

#### 问题 C：非流式回退逻辑同样存在问题

在 `event_stream()` 的回退逻辑和 `chat()` 的非流式回退中，引用提取逻辑也有同样的问题。

### 2. 前端层问题 (`client/src/services/sse.ts`)

**当前代码基本正确**，因为 BFF 会在流结束后发送 `references` 事件（数组格式）。但需要确认：
- BFF 发送的 `references` 事件格式正确
- 前端能正确解析和显示

### 3. Mock 服务问题 (`server/tests/mock_ragflow.py`)

Mock 服务没有模拟 RAGFlow v0.24+ 的 reference 格式，导致测试无法覆盖真实场景。

---

## 三、修复方案

### 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `server/app/routers/chat.py` | **主要修改** | 修复 `_simplify_references()` 和引用提取逻辑 |
| `server/tests/mock_ragflow.py` | **主要修改** | 更新 mock 服务输出 RAGFlow v0.24+ 格式的 reference |
| `server/app/ragflow.py` | **轻微修改** | 无需修改（请求已正确配置 `extra_body`） |
| `client/src/services/sse.ts` | **无需修改** | 前端逻辑正确，能处理 BFF 转换后的数组格式 |
| `client/src/components/chat/MessageBubble.vue` | **无需修改** | 组件已正确实现引用显示 |

### 详细修改方案

#### 1. 修改 `_simplify_references()` 函数

**位置**：`server/app/routers/chat.py` 第 44-63 行

**修改为**：
```python
def _simplify_references(refs) -> list:
    """Extract display-relevant fields from RAGFlow citation chunks.

    Supports both RAGFlow v0.24+ (object with 'chunks' key) and legacy (array) formats.
    """
    simplified = []

    # Handle RAGFlow v0.24+ format: {"chunks": {...}, "doc_aggs": {...}}
    if isinstance(refs, dict):
        chunks = refs.get("chunks", {})
        if isinstance(chunks, dict):
            for chunk_id, chunk in chunks.items():
                if not isinstance(chunk, dict):
                    continue
                simplified.append({
                    "document_name": chunk.get("document_name") or "",
                    "content": chunk.get("content") or "",
                    "document_id": chunk.get("document_id") or "",
                    "dataset_id": chunk.get("dataset_id") or "",
                })
        return simplified

    # Handle legacy format: array of citation objects
    if isinstance(refs, list):
        for r in refs:
            if not isinstance(r, dict):
                continue
            simplified.append({
                "document_name": r.get("document_name") or r.get("docnm_kwd") or "",
                "content": r.get("content") or r.get("content_with_weight") or "",
                "document_id": r.get("document_id") or r.get("doc_id") or "",
                "dataset_id": r.get("dataset_id") or r.get("kb_id") or "",
            })

    return simplified
```

#### 2. 修改引用提取逻辑（流式）

**位置**：`server/app/routers/chat.py` 第 319-324 行

**修改为**：
```python
# 3) 引用：可能位于 delta.reference 或顶层 reference 字段（v0.24+ 为对象，旧版为数组）
ref_raw = delta.get("reference") or parsed.get("reference")
if ref_raw:
    references = _simplify_references(ref_raw)
```

#### 3. 修改引用提取逻辑（非流式回退）

**位置**：`server/app/routers/chat.py` 多处

所有 `_simplify_references()` 调用处都需要确保传入的参数能被正确处理。由于 `_simplify_references()` 已改为兼容两种格式，调用处的代码可保持不变。

#### 4. 更新 Mock 服务

**位置**：`server/tests/mock_ragflow.py`

**修改为模拟 RAGFlow v0.24+ 的 reference 格式**：
```python
# 在 SSE 流的最后一个 chunk 中添加 reference
STREAM_PIECES = ["你好，", "这是来自", "RAGFlow 的", "流式测试回复。"]

# 添加包含 reference 的 chunk
REFERENCE_CHUNK = {
    "choices": [{
        "delta": {
            "content": "",
            "reference": {
                "chunks": {
                    "20": {
                        "id": "4b8935ac0a22deb1",
                        "content": "这是引用的文档内容片段...",
                        "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "document_name": "INSTALL22.md",
                        "document_metadata": {"author": "bob", "year": "2023"},
                        "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                        "similarity": 0.5697155305154673,
                        "vector_similarity": 0.7323851005515574,
                        "term_similarity": 0.5000000005,
                        "positions": [[12, 11, 11, 11, 11]],
                        "url": None,
                        "doc_type": ""
                    }
                },
                "doc_aggs": {
                    "INSTALL22.md": {
                        "doc_name": "INSTALL22.md",
                        "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                        "count": 1
                    }
                }
            }
        }
    }]
}
```

---

## 四、数据流示意

### 修复前（当前）
```
RAGFlow API (v0.24+)
    ↓ reference = {"chunks": {...}, "doc_aggs": {...}}  (对象)
    ↓
BFF 层 (chat.py)
    ↓ _simplify_references(refs: list)  ← 类型错误！
    ↓ for r in refs:  ← 遍历字典 key，不是 chunk 对象
    ↓ 结果：无法正确提取字段
    ↓
前端 SSE 解析 (sse.ts)
    ↓ parsed.references 为空或格式错误
    ↓
MessageBubble.vue
    ↓ refs.length = 0
    ↓ 不显示引用来源
```

### 修复后
```
RAGFlow API (v0.24+)
    ↓ reference = {"chunks": {...}, "doc_aggs": {...}}  (对象)
    ↓
BFF 层 (chat.py)
    ↓ _simplify_references(refs)  ← 接受 dict 或 list
    ↓ 检测到 dict 格式，提取 chunks
    ↓ 转换为 [{"document_name": "...", "content": "...", ...}]  (数组)
    ↓
前端 SSE 解析 (sse.ts)
    ↓ parsed.references 正确接收数组
    ↓
MessageBubble.vue
    ↓ refs.length > 0
    ↓ 正确显示引用来源 ✅
```

---

## 五、风险与注意事项

1. **版本兼容性**：修改后的 `_simplify_references()` 函数需要同时支持：
   - RAGFlow v0.24+ 格式（对象，含 `chunks`）
   - RAGFlow 旧版格式（数组）
   - 无效输入（`None`、空数组等）

2. **数据完整性**：引用数据中的 `similarity`、`positions` 等字段当前前端不需要，但保留在原始数据中以备将来扩展。

3. **测试覆盖**：Mock 服务更新后，需要验证：
   - 流式场景下引用能正确提取和显示
   - 非流式回退场景下引用能正确提取
   - 历史消息加载时引用能正确还原

4. **性能影响**：无显著性能影响，引用处理为轻量操作。

---

## 六、执行步骤

1. 修改 `_simplify_references()` 函数以支持两种格式
2. 修改引用提取逻辑（移除 `isinstance(ref_raw, list)` 限制）
3. 更新 Mock 服务输出 RAGFlow v0.24+ 格式数据
4. 运行集成测试验证修复
5. 端到端测试验证引用显示
