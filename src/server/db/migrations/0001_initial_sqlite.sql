-- Migration: 0001_initial (SQLite variant)
-- Description: Create all base tables for SQLite (self-hosted) deployments

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA auto_vacuum = INCREMENTAL;

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT UNIQUE,
  name              TEXT,
  avatar            TEXT,
  role              TEXT DEFAULT 'user',
  anthropic_api_key TEXT,
  preferences       TEXT DEFAULT '{}',  -- JSON stored as text
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  title         TEXT,
  model         TEXT,
  system_prompt TEXT,
  is_pinned     INTEGER DEFAULT 0,  -- SQLite boolean
  tags          TEXT DEFAULT '[]',  -- JSON array as text
  metadata      TEXT DEFAULT '{}',  -- JSON object as text
  message_count INTEGER DEFAULT 0,
  token_count   INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id    ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT,
  content         TEXT,  -- JSON stored as text
  model           TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  stop_reason     TEXT,
  duration_ms     INTEGER,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  content,
  content='messages',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, message_id, content)
  VALUES (new.rowid, new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, message_id, content)
  VALUES ('delete', old.rowid, old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, message_id, content)
  VALUES ('delete', old.rowid, old.id, old.content);
  INSERT INTO messages_fts(rowid, message_id, content)
  VALUES (new.rowid, new.id, new.content);
END;

-- ============================================================
-- Tool Uses
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_uses (
  id          TEXT PRIMARY KEY,
  message_id  TEXT REFERENCES messages(id) ON DELETE CASCADE,
  tool_name   TEXT,
  input       TEXT,  -- JSON
  output      TEXT,  -- JSON
  status      TEXT,
  duration_ms INTEGER,
  approved_by TEXT REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tool_uses_message_id ON tool_uses(message_id);

-- ============================================================
-- Sessions (auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  data       TEXT,  -- JSON
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================
-- Shared Links
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_links (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  created_by      TEXT REFERENCES users(id),
  access_level    TEXT,
  password_hash   TEXT,
  expires_at      TEXT,
  view_count      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);
