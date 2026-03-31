/**
 * Conversation service — CRUD operations over the DB store.
 */

import { db, flush } from "../db/connection.js";
import type {
  DbConversation,
  DbMessage,
  DbMessageRole,
  DbToolUse,
  DbToolStatus,
} from "../db/schema.js";
import { ApiError } from "../middleware/error-handler.js";

// ── Public view types ─────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  isPinned: boolean;
  tags: string[];
  preview: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ConversationWithMessages extends DbConversation {
  messages: DbMessage[];
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function listConversations(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): { conversations: ConversationSummary[]; total: number } {
  const { limit = 50, offset = 0 } = opts;
  const store = db();

  const all = Object.values(store.conversations)
    .filter((c) => c.userId === userId)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  const total = all.length;
  const page = all.slice(offset, offset + limit);

  const summaries: ConversationSummary[] = page.map((c) => {
    const messages = Object.values(store.messages).filter(
      (m) => m.conversationId === c.id,
    );
    const lastMsg = messages[messages.length - 1];
    let preview = "";
    if (lastMsg) {
      try {
        const content = JSON.parse(lastMsg.contentJson);
        if (typeof content === "string") preview = content.slice(0, 120);
        else if (Array.isArray(content)) {
          const text = content.find((b: { type: string }) => b.type === "text");
          preview = (text as { text: string } | undefined)?.text?.slice(0, 120) ?? "";
        }
      } catch {
        preview = "";
      }
    }
    return {
      id: c.id,
      title: c.title,
      model: c.model,
      isPinned: c.isPinned,
      tags: c.tags,
      preview,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: messages.length,
    };
  });

  return { conversations: summaries, total };
}

export function createConversation(
  userId: string,
  opts: { title?: string; model?: string },
): DbConversation {
  const id = crypto.randomUUID();
  const now = Date.now();
  const conv: DbConversation = {
    id,
    userId,
    title: opts.title ?? "New conversation",
    model: opts.model ?? process.env.DEFAULT_MODEL ?? "claude-opus-4-6",
    isPinned: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  db().conversations[id] = conv;
  flush();
  return conv;
}

export function getConversation(id: string, userId: string): ConversationWithMessages {
  const conv = db().conversations[id];
  if (!conv) throw ApiError.notFound("Conversation");
  if (conv.userId !== userId) throw ApiError.notFound("Conversation");

  const messages = Object.values(db().messages)
    .filter((m) => m.conversationId === id)
    .sort((a, b) => a.createdAt - b.createdAt);

  return { ...conv, messages };
}

export function updateConversation(
  id: string,
  userId: string,
  updates: Partial<Pick<DbConversation, "title" | "model" | "isPinned" | "tags">>,
): DbConversation {
  const conv = db().conversations[id];
  if (!conv) throw ApiError.notFound("Conversation");
  if (conv.userId !== userId) throw ApiError.notFound("Conversation");

  Object.assign(conv, { ...updates, updatedAt: Date.now() });
  flush();
  return conv;
}

export function deleteConversation(id: string, userId: string): void {
  const conv = db().conversations[id];
  if (!conv) throw ApiError.notFound("Conversation");
  if (conv.userId !== userId) throw ApiError.notFound("Conversation");

  const store = db();
  // Delete messages and tool uses
  const msgIds = Object.values(store.messages)
    .filter((m) => m.conversationId === id)
    .map((m) => m.id);
  for (const mid of msgIds) {
    const tuIds = Object.values(store.toolUses)
      .filter((t) => t.messageId === mid)
      .map((t) => t.id);
    for (const tid of tuIds) delete store.toolUses[tid];
    delete store.messages[mid];
  }
  delete store.conversations[id];
  flush();
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function addMessage(
  conversationId: string,
  userId: string,
  msg: {
    role: DbMessageRole;
    content: unknown;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  },
): DbMessage {
  const conv = db().conversations[conversationId];
  if (!conv) throw ApiError.notFound("Conversation");
  if (conv.userId !== userId) throw ApiError.notFound("Conversation");

  const id = crypto.randomUUID();
  const now = Date.now();
  const dbMsg: DbMessage = {
    id,
    conversationId,
    role: msg.role,
    contentJson: JSON.stringify(msg.content),
    model: msg.model,
    inputTokens: msg.inputTokens,
    outputTokens: msg.outputTokens,
    createdAt: now,
  };
  db().messages[id] = dbMsg;
  conv.updatedAt = now;
  flush();
  return dbMsg;
}

export function getMessages(conversationId: string, userId: string): DbMessage[] {
  const conv = db().conversations[conversationId];
  if (!conv) throw ApiError.notFound("Conversation");
  if (conv.userId !== userId) throw ApiError.notFound("Conversation");

  return Object.values(db().messages)
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function deleteLastAssistantMessage(conversationId: string, userId: string): void {
  const messages = getMessages(conversationId, userId);
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (last) {
    // Remove associated tool uses
    const store = db();
    const tuIds = Object.values(store.toolUses)
      .filter((t) => t.messageId === last.id)
      .map((t) => t.id);
    for (const tid of tuIds) delete store.toolUses[tid];
    delete store.messages[last.id];
    flush();
  }
}

// ── Tool uses ─────────────────────────────────────────────────────────────────

export function recordToolUse(
  messageId: string,
  tool: {
    id: string;
    toolName: string;
    inputJson: string;
    status?: DbToolStatus;
  },
): DbToolUse {
  const id = tool.id;
  const now = Date.now();
  const tu: DbToolUse = {
    id,
    messageId,
    toolName: tool.toolName,
    inputJson: tool.inputJson,
    status: tool.status ?? "pending",
    createdAt: now,
  };
  db().toolUses[id] = tu;
  flush();
  return tu;
}

export function updateToolUse(
  id: string,
  updates: Partial<Pick<DbToolUse, "outputJson" | "status" | "durationMs">>,
): DbToolUse | undefined {
  const tu = db().toolUses[id];
  if (!tu) return undefined;
  Object.assign(tu, updates);
  flush();
  return tu;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportConversation(
  id: string,
  userId: string,
  format: "json" | "markdown" | "plaintext",
): string {
  const conv = getConversation(id, userId);

  if (format === "json") {
    return JSON.stringify(
      {
        conversation: conv,
        messages: conv.messages.map((m) => ({
          ...m,
          content: JSON.parse(m.contentJson),
        })),
      },
      null,
      2,
    );
  }

  const lines: string[] = [];

  if (format === "markdown") {
    lines.push(`# ${conv.title}`, "", `*Model: ${conv.model}*`, "");
  }

  for (const msg of conv.messages) {
    let content: unknown;
    try {
      content = JSON.parse(msg.contentJson);
    } catch {
      content = msg.contentJson;
    }
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? (content as Array<{ type: string; text?: string }>)
              .filter((b) => b.type === "text")
              .map((b) => b.text ?? "")
              .join("\n")
          : "";

    if (format === "markdown") {
      const prefix = msg.role === "user" ? "**User**" : "**Assistant**";
      lines.push(`${prefix}:`, "", text, "");
    } else {
      lines.push(`${msg.role.toUpperCase()}:`, text, "");
    }
  }

  return lines.join("\n");
}
