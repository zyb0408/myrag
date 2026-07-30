export const SCHEMA = `
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
  \"references\"      TEXT,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
`;

// Migration: if conversations table was created without user_id column
export const MIGRATION = `
ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id);
`;
