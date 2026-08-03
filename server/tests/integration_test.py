# -*- coding: utf-8 -*-
"""BFF integration test — verifies every API contract against the Python rewrite.

Prerequisites:
  1. Mock RAGFlow is running on :9380  (uv run python tests/mock_ragflow.py)
  2. BFF server is running on :3001    (uv run uvicorn app.main:app --port 3001)
  3. The SQLite DB contains the seeded admin account (admin / admin123)

Run: uv run python tests/integration_test.py
"""
import json
import re
import sys
import time
import uuid

import httpx

BASE = "http://localhost:3001"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

passed: list[str] = []
failed: list[str] = []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        passed.append(name)
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}  -> {detail}")


def r(method: str, path: str, **kw):
    return httpx.request(method, BASE + path, timeout=30, **kw)


def section(title: str):
    print(f"\n== {title} ==")


def summary():
    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(passed) + len(failed)}  PASSED: {len(passed)}  FAILED: {len(failed)}")
    if failed:
        print("FAILED CASES:")
        for f in failed:
            print(f"  - {f}")
        sys.exit(1)
    print("ALL TESTS PASSED")


def main():
    # ------------------------------------------------------------------ auth
    section("1. Auth — POST /api/auth/login")
    resp = r("POST", "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    data = resp.json().get("data", {}) if ok else {}
    check("login success -> 200 code:0, token+user", ok, resp.text[:200])
    check(
        "login user shape {id,username,displayName,isAdmin,mustResetPassword}",
        ok and set(data.get("user", {}).keys()) == {"id", "username", "displayName", "isAdmin", "mustResetPassword"},
        str(data.get("user")),
    )
    check("login token is non-empty JWT", bool(data.get("token")), str(data.get("token")))
    admin_token = data.get("token", "")

    resp = r("POST", "/api/auth/login", json={"username": ADMIN_USERNAME, "password": "wrong-password"})
    check("login wrong password -> 401 {code:1,message:'用户名或密码错误'}",
          resp.status_code == 401 and resp.json() == {"code": 1, "message": "用户名或密码错误"}, resp.text)

    resp = r("POST", "/api/auth/login", json={})
    check("login missing fields -> 400 {code:1,message:'用户名和密码不能为空'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "用户名和密码不能为空"}, resp.text)

    # ------------------------------------------------------------------ me
    section("2. Auth — GET /api/auth/me")
    resp = r("GET", "/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    check("me with token -> 200 code:0", ok, resp.text)
    check("me returns admin user", ok and resp.json()["data"]["username"] == ADMIN_USERNAME, resp.text)

    resp = r("GET", "/api/auth/me")
    check("me without token -> 401 {code:401,message:'未登录，请先登录'}",
          resp.status_code == 401 and resp.json() == {"code": 401, "message": "未登录，请先登录"}, resp.text)

    resp = r("GET", "/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    check("me invalid token -> 401 {code:401,message:'登录已过期，请重新登录'}",
          resp.status_code == 401 and resp.json() == {"code": 401, "message": "登录已过期，请重新登录"}, resp.text)

    # --------------------------------------------------------------- admin
    section("3. Admin — /api/admin/*")
    resp = r("GET", "/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    users = resp.json().get("data", []) if ok else []
    check("admin list users -> 200 code:0", ok, resp.text)
    check(
        "user shape includes {id,username,displayName,mustResetPassword,isActive,isAdmin,createdAt}",
        ok and all(
            set(u.keys()) == {"id", "username", "displayName", "mustResetPassword", "isActive", "isAdmin", "createdAt"}
            for u in users
        ),
        str(users[:1]),
    )

    # non-admin user gets 403
    suffix = str(uuid.uuid4())[:8]
    test_username = f"test_user_{suffix}"
    resp = r("POST", "/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"},
             json={"username": test_username, "password": "test123456", "displayName": "测试用户"})
    check("create user -> 200 {mustResetPassword:true,isActive:true,isAdmin:false}",
          resp.status_code == 200 and resp.json()["data"].get("mustResetPassword") is True
          and resp.json()["data"].get("isActive") is True and resp.json()["data"].get("isAdmin") is False, resp.text)
    created_user = resp.json().get("data", {})

    resp = r("POST", "/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"},
             json={"username": test_username, "password": "test123456", "displayName": "测试用户"})
    check("create duplicate username -> 400 {code:1,message:'用户名已存在'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "用户名已存在"}, resp.text)

    resp = r("POST", "/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"},
             json={"username": f"u_{suffix}", "password": "123", "displayName": "短密码"})
    check("create short password -> 400 {code:1,message:'密码至少 6 位'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "密码至少 6 位"}, resp.text)

    # login as the new user -> 403 for admin routes
    resp = r("POST", "/api/auth/login", json={"username": test_username, "password": "test123456"})
    user_token = resp.json()["data"]["token"]
    resp = r("GET", "/api/admin/users", headers={"Authorization": f"Bearer {user_token}"})
    check("non-admin access admin api -> 403 {code:403,message:'仅管理员可操作'}",
          resp.status_code == 403 and resp.json() == {"code": 403, "message": "仅管理员可操作"}, resp.text)

    # admin resets the user's password
    resp = r("PATCH", f"/api/admin/users/{created_user['id']}/reset-password",
             headers={"Authorization": f"Bearer {admin_token}"}, json={"newPassword": "newpass123"})
    check("admin reset password -> 200 {success:true}",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": {"success": True}}, resp.text)

    # reset-password flow for the new user (old pwd wrong -> 401, success -> 200)
    resp = r("POST", "/api/auth/reset-password",
             json={"username": test_username, "oldPassword": "wrong", "newPassword": "brandnew123"})
    check("reset-password wrong old pwd -> 401 {code:1,message:'原密码错误'}",
          resp.status_code == 401 and resp.json() == {"code": 1, "message": "原密码错误"}, resp.text)

    resp = r("POST", "/api/auth/reset-password",
             json={"username": test_username, "oldPassword": "newpass123", "newPassword": "brandnew123"})
    check("reset-password success -> 200 {success:true}",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": {"success": True}}, resp.text)

    resp = r("POST", "/api/auth/reset-password",
             json={"username": test_username, "oldPassword": "newpass123", "newPassword": "123"})
    check("reset-password short new pwd -> 400 {code:1,message:'新密码至少 6 位'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "新密码至少 6 位"}, resp.text)

    # cannot delete yourself
    resp = r("DELETE", f"/api/admin/users/{data['user']['id']}",
             headers={"Authorization": f"Bearer {admin_token}"})
    check("delete self -> 400 {code:1,message:'不能删除自己'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "不能删除自己"}, resp.text)

    # delete the test user
    resp = r("DELETE", f"/api/admin/users/{created_user['id']}",
             headers={"Authorization": f"Bearer {admin_token}"})
    check("delete user -> 200 {success:true}",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": {"success": True}}, resp.text)

    # ------------------------------------------------- knowledge bases / assistants
    section("4. Knowledge bases & chat assistants (RAGFlow passthrough)")
    resp = r("GET", "/api/knowledge-bases")
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    kbs = resp.json().get("data", []) if ok else []
    check("GET /api/knowledge-bases -> 200 code:0", ok, resp.text)
    check("dataset shape {id,name,description,document_count,chunk_count,embedding_model,status,create_time,update_time}",
          ok and all(
              set(k.keys()) == {"id", "name", "description", "document_count", "chunk_count",
                                "embedding_model", "status", "create_time", "update_time"}
              for k in kbs
          ), str(kbs[:1]))

    resp = r("GET", "/api/chat-assistants")
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    chats = resp.json().get("data", []) if ok else []
    check("GET /api/chat-assistants -> 200 code:0", ok, resp.text)
    check("chat shape {id,name,description,dataset_ids,kb_names,llm_id,icon,status,create_time,update_time}",
          ok and all(
              set(c.keys()) == {"id", "name", "description", "dataset_ids", "kb_names",
                                "llm_id", "icon", "status", "create_time", "update_time"}
              for c in chats
          ), str(chats[:1]))

    # ---------------------------------------------------------- conversations
    section("5. Conversations — /api/conversations/*")
    resp = r("POST", "/api/conversations", headers={"Authorization": f"Bearer {admin_token}"},
             json={"assistant_id": "chat-001", "kb_id": "kb-001", "kb_name": "产品手册知识库"})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    conv = resp.json().get("data", {}) if ok else {}
    check("create conversation (no name) -> 200", ok, resp.text)
    check("default name matches JS toLocaleString('zh-CN') pattern '新对话 Y/M/D HH:mm:ss'",
          ok and re.fullmatch(r"新对话 \d{4}/\d{1,2}/\d{1,2} \d{2}:\d{2}:\d{2}", conv.get("name", "")),
          conv.get("name"))
    check("conversation shape {id,name,assistant_id,kb_id,kb_name,user_id,created_at,updated_at}",
          ok and set(conv.keys()) == {"id", "name", "assistant_id", "kb_id", "kb_name",
                                      "user_id", "created_at", "updated_at"}, str(conv))
    conv_id = conv.get("id", "")

    resp = r("POST", "/api/conversations", headers={"Authorization": f"Bearer {admin_token}"},
             json={"name": "自定义对话", "assistant_id": "chat-001", "kb_id": "kb-002", "kb_name": "FAQ 知识库"})
    check("create conversation with name -> 200, name kept",
          resp.status_code == 200 and resp.json()["data"].get("name") == "自定义对话", resp.text)
    conv2_id = resp.json()["data"]["id"]

    resp = r("POST", "/api/conversations", headers={"Authorization": f"Bearer {admin_token}"},
             json={"name": "缺参数"})
    check("create conversation missing args -> 400 {code:1,message:'assistant_id, kb_id, and kb_name are required'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "assistant_id, kb_id, and kb_name are required"}, resp.text)

    resp = r("GET", "/api/conversations", headers={"Authorization": f"Bearer {admin_token}"})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    check("list conversations -> 200 code:0 (contains created conv)",
          ok and any(c["id"] == conv_id for c in resp.json()["data"]), resp.text)

    resp = r("GET", "/api/conversations?kb_id=kb-001", headers={"Authorization": f"Bearer {admin_token}"})
    ok = resp.status_code == 200 and resp.json().get("code") == 0
    check("list conversations filtered by kb_id -> only kb-001",
          ok and all(c["kb_id"] == "kb-001" for c in resp.json()["data"]), resp.text)

    resp = r("PATCH", f"/api/conversations/{conv_id}", headers={"Authorization": f"Bearer {admin_token}"},
             json={"name": "重命名后的对话"})
    check("rename conversation -> 200, name updated",
          resp.status_code == 200 and resp.json()["data"].get("name") == "重命名后的对话", resp.text)

    resp = r("PATCH", f"/api/conversations/{conv_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={})
    check("rename conversation missing name -> 400 {code:1,message:'name is required'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "name is required"}, resp.text)

    resp = r("GET", f"/api/conversations/{conv_id}/messages", headers={"Authorization": f"Bearer {admin_token}"})
    check("get messages (empty) -> 200 []",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": []}, resp.text)

    resp = r("GET", "/api/conversations/nonexistent-id/messages", headers={"Authorization": f"Bearer {admin_token}"})
    check("get messages of missing conv -> 404 {code:1,message:'Conversation not found'}",
          resp.status_code == 404 and resp.json() == {"code": 1, "message": "Conversation not found"}, resp.text)

    # ---------------------------------------------------------------- chat SSE
    section("6. Chat — POST /api/chat/{convId} (SSE stream)")
    resp = r("POST", f"/api/chat/{conv_id}", headers={"Authorization": f"Bearer {admin_token}"},
             json={"content": "请介绍一下产品功能"})
    ok = resp.status_code == 200 and resp.headers.get("content-type", "").startswith("text/event-stream")
    check("chat -> 200 text/event-stream", ok, f"status={resp.status_code} ct={resp.headers.get('content-type')}")

    stream_text = resp.text
    data_lines = [ln for ln in stream_text.split("\n") if ln.startswith("data: ")]
    check("SSE receives content chunks from RAGFlow",
          any(json.loads(ln[6:]).get("choices", [{}])[0].get("delta", {}).get("content") for ln in data_lines),
          stream_text[:200])
    check("SSE ends with data: [DONE]", data_lines and data_lines[-1] == "data: [DONE]", str(data_lines[-3:]))
    check("assistant reply persisted (legacy bug fix)",
          any("RAGFlow 的" in ln for ln in data_lines) or "RAGFlow 的" in stream_text, stream_text[:200])

    # user + assistant messages must both be stored
    time.sleep(0.2)
    resp = r("GET", f"/api/conversations/{conv_id}/messages", headers={"Authorization": f"Bearer {admin_token}"})
    msgs = resp.json().get("data", [])
    roles = [m["role"] for m in msgs]
    check("messages stored: first=user, last=assistant (assistant persistence fixed)",
          len(msgs) >= 2 and roles[0] == "user" and roles[-1] == "assistant"
          and "流式测试回复" in msgs[-1]["content"], str(msgs))

    resp = r("POST", f"/api/chat/{conv_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={})
    check("chat missing content -> 400 {code:1,message:'content is required'}",
          resp.status_code == 400 and resp.json() == {"code": 1, "message": "content is required"}, resp.text)

    resp = r("POST", "/api/chat/nonexistent-conv", headers={"Authorization": f"Bearer {admin_token}"},
             json={"content": "hi"})
    check("chat missing conversation -> 404 {code:1,message:'Conversation not found'}",
          resp.status_code == 404 and resp.json() == {"code": 1, "message": "Conversation not found"}, resp.text)

    resp = r("POST", f"/api/chat/{conv_id}/stop", headers={"Authorization": f"Bearer {admin_token}"})
    check("stop chat -> 200 {code:0,data:{stopped:true}}",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": {"stopped": True}}, resp.text)

    # ------------------------------------------------------------- cleanup
    section("7. Cleanup")
    resp = r("DELETE", f"/api/conversations/{conv_id}", headers={"Authorization": f"Bearer {admin_token}"})
    check("delete conversation -> 200 {code:0,data:true}",
          resp.status_code == 200 and resp.json() == {"code": 0, "data": True}, resp.text)
    resp = r("DELETE", f"/api/conversations/{conv2_id}", headers={"Authorization": f"Bearer {admin_token}"})
    check("delete second conversation -> 200", resp.status_code == 200, resp.text)

    resp = r("GET", "/api/health")
    check("health check -> {status:'ok'}", resp.json() == {"status": "ok"}, resp.text)

    summary()


if __name__ == "__main__":
    main()
