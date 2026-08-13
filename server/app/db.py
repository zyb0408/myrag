# -*- coding: utf-8 -*-
"""SQLite persistence layer (equivalent to original server/src/db/index.ts + db/schema.ts).

Reuses the exact same database file as the legacy implementation
(server/data/ragflow-chat.db) so existing users / conversations / messages
keep working without any data migration.
"""
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "ragflow-chat.db"

# Same schema as the original db/schema.ts
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  username            TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  must_reset_password INTEGER DEFAULT 1,
  is_active           INTEGER DEFAULT 1,
  is_admin            INTEGER DEFAULT 0,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  assistant_id  TEXT NOT NULL,
  kb_id         TEXT NOT NULL,
  kb_name       TEXT NOT NULL,
  user_id       TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  "references"      TEXT,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
"""

# Migration: add user_id column to conversations if missing
MIGRATION = "ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id);"

_conn: sqlite3.Connection | None = None


def utc_now_iso() -> str:
    """Equivalent to JS `new Date().toISOString()` — UTC with millisecond precision + 'Z'."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")

        conn.executescript(SCHEMA)

        # Migration for existing databases that lack user_id column
        try:
            cols = [row[1] for row in conn.execute("PRAGMA table_info(conversations)").fetchall()]
            if "user_id" not in cols:
                logger.info("Running migration: adding user_id column to conversations")
                conn.execute(MIGRATION)
                conn.commit()
        except sqlite3.Error:
            # Table doesn't exist yet — schema will create it
            pass

        # Seed admin user if users table is empty
        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if count == 0:
            logger.info("Seeding default admin user...")
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt(10)).decode("utf-8")
            conn.execute(
                "INSERT INTO users (id, username, password_hash, display_name, must_reset_password, is_active, is_admin, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), "admin", hashed, "管理员", 1, 1, 1, utc_now_iso()),
            )
            conn.commit()
            logger.info("Default admin created: username=admin, password=admin123")

        _conn = conn
    return _conn


def close_db() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def query_all(sql: str, params: list = ()) -> list[dict]:
    rows = get_db().execute(sql, params).fetchall()
    return [_row_to_dict(row) for row in rows]


def query_one(sql: str, params: list = ()) -> dict | None:
    row = get_db().execute(sql, params).fetchone()
    return _row_to_dict(row)


def execute(sql: str, params: list = ()) -> None:
    conn = get_db()
    conn.execute(sql, params)
    conn.commit()
