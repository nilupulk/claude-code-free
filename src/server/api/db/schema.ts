/**
 * Database schema types.
 * The backing store is a JSON file; this module only defines the shapes.
 * Swap connection.ts to use SQLite/PostgreSQL without changing anything here.
 */

// ── Conversations ────────────────────────────────────────────────────────────

export interface DbConversation {
  id: string;
  userId: string;
  title: string;
  model: string;
  isPinned: boolean;
  tags: string[];
  createdAt: number; // ms since epoch
  updatedAt: number;
}

// ── Messages ─────────────────────────────────────────────────────────────────

export type DbMessageRole = "user" | "assistant" | "system" | "tool";

export interface DbMessage {
  id: string;
  conversationId: string;
  role: DbMessageRole;
  /** JSON-serialised ContentBlock[] | string */
  contentJson: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: number;
}

// ── Tool uses ─────────────────────────────────────────────────────────────────

export type DbToolStatus = "pending" | "approved" | "denied" | "complete" | "error";

export interface DbToolUse {
  id: string;
  messageId: string;
  toolName: string;
  inputJson: string;
  outputJson?: string;
  status: DbToolStatus;
  durationMs?: number;
  createdAt: number;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface DbSettings {
  userId: string;
  /** JSON blob of AppSettings */
  settingsJson: string;
  updatedAt: number;
}

// ── Running processes ─────────────────────────────────────────────────────────

export interface DbExecProcess {
  id: string;
  command: string;
  pid?: number;
  status: "running" | "done" | "error" | "killed";
  exitCode?: number;
  startedAt: number;
  endedAt?: number;
}

// ── Root store shape ──────────────────────────────────────────────────────────

export interface DbStore {
  conversations: Record<string, DbConversation>;
  messages: Record<string, DbMessage>;
  toolUses: Record<string, DbToolUse>;
  settings: Record<string, DbSettings>;
  /** processes are ephemeral — not persisted */
  processes: Record<string, DbExecProcess>;
}

export function emptyStore(): DbStore {
  return {
    conversations: {},
    messages: {},
    toolUses: {},
    settings: {},
    processes: {},
  };
}
