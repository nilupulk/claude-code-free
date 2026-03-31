-- Migration: 0001_initial
-- Description: Create all base tables for the Claude Code web app

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE,
  name        VARCHAR(255),
  avatar      VARCHAR(500),
  role        VARCHAR(50)  DEFAULT 'user',
  anthropic_api_key TEXT,
  preferences JSONB        DEFAULT '{}',
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  title         VARCHAR(500),
  model         VARCHAR(100),
  system_prompt TEXT,
  is_pinned     BOOLEAN   DEFAULT FALSE,
  tags          JSONB     DEFAULT '[]',
  metadata      JSONB     DEFAULT '{}',
  message_count INTEGER   DEFAULT 0,
  token_count   INTEGER   DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id   ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(20),
  content         JSONB,
  model           VARCHAR(100),
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  stop_reason     VARCHAR(50),
  duration_ms     INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);

-- Full-text search index (PostgreSQL only)
CREATE INDEX IF NOT EXISTS idx_messages_content_search
  ON messages USING GIN (to_tsvector('english', content::text));

-- ============================================================
-- Tool Uses
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_uses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  tool_name   VARCHAR(100),
  input       JSONB,
  output      JSONB,
  status      VARCHAR(20),
  duration_ms INTEGER,
  approved_by UUID REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_uses_message_id ON tool_uses(message_id);

-- ============================================================
-- Sessions (auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(128) PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  data       JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================
-- Shared Links
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_links (
  id              VARCHAR(32) PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  created_by      UUID REFERENCES users(id),
  access_level    VARCHAR(20),
  password_hash   VARCHAR(255),
  expires_at      TIMESTAMP,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);
