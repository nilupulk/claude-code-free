/**
 * Search service — full-text search over conversations and messages.
 * Uses Fuse.js for fuzzy in-memory search (already a project dependency).
 */

import Fuse from "fuse.js";
import { db } from "../db/connection.js";
import type { DbMessage } from "../db/schema.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  dateFrom?: number;
  dateTo?: number;
  role?: string | null;
  conversationId?: string | null;
}

export interface SearchResultMatch {
  messageId: string;
  conversationId: string;
  role: string;
  excerpt: string;
  highlighted: string;
  score: number;
}

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  conversationDate: number;
  conversationModel: string;
  matches: SearchResultMatch[];
  totalScore: number;
}

// ── Index document ────────────────────────────────────────────────────────────

interface IndexDoc {
  messageId: string;
  conversationId: string;
  role: string;
  text: string;
  createdAt: number;
}

function extractText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text ?? "")
        .join(" ");
    }
  } catch {
    return contentJson;
  }
  return contentJson;
}

function buildIndex(messages: DbMessage[], filters: SearchFilters): IndexDoc[] {
  return messages
    .filter((m) => {
      if (filters.role && m.role !== filters.role) return false;
      if (filters.conversationId && m.conversationId !== filters.conversationId) return false;
      if (filters.dateFrom && m.createdAt < filters.dateFrom) return false;
      if (filters.dateTo && m.createdAt > filters.dateTo) return false;
      return true;
    })
    .map((m) => ({
      messageId: m.id,
      conversationId: m.conversationId,
      role: m.role,
      text: extractText(m.contentJson),
      createdAt: m.createdAt,
    }));
}

// ── Highlight helper ──────────────────────────────────────────────────────────

function highlight(text: string, query: string): string {
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}

function excerpt(text: string, query: string, radius = 80): string {
  const lower = text.toLowerCase();
  const queryLower = query.toLowerCase().split(/\s+/)[0] ?? "";
  const idx = lower.indexOf(queryLower);
  if (idx === -1) return text.slice(0, 160);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + queryLower.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

// ── Main search function ──────────────────────────────────────────────────────

export function searchConversations(
  userId: string,
  query: string,
  filters: SearchFilters = {},
  limit = 20,
): SearchResult[] {
  const store = db();

  const userConvIds = new Set(
    Object.values(store.conversations)
      .filter((c) => c.userId === userId)
      .map((c) => c.id),
  );

  const messages = Object.values(store.messages).filter((m) =>
    userConvIds.has(m.conversationId),
  );

  const docs = buildIndex(messages, filters);
  if (docs.length === 0) return [];

  const fuse = new Fuse(docs, {
    keys: ["text"],
    includeScore: true,
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  const results = fuse.search(query, { limit: limit * 5 });

  // Group by conversation
  const byConv = new Map<string, SearchResult>();

  for (const hit of results) {
    const doc = hit.item;
    const score = 1 - (hit.score ?? 1);
    const conv = store.conversations[doc.conversationId];
    if (!conv) continue;

    if (!byConv.has(conv.id)) {
      byConv.set(conv.id, {
        conversationId: conv.id,
        conversationTitle: conv.title,
        conversationDate: conv.updatedAt,
        conversationModel: conv.model,
        matches: [],
        totalScore: 0,
      });
    }

    const result = byConv.get(conv.id)!;
    const ex = excerpt(doc.text, query);
    result.matches.push({
      messageId: doc.messageId,
      conversationId: doc.conversationId,
      role: doc.role,
      excerpt: ex,
      highlighted: highlight(ex, query),
      score,
    });
    result.totalScore += score;
  }

  return [...byConv.values()]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

// ── Autocomplete suggestions ──────────────────────────────────────────────────

export function searchSuggestions(userId: string, query: string): string[] {
  const store = db();
  const titles = Object.values(store.conversations)
    .filter((c) => c.userId === userId)
    .map((c) => c.title);

  const fuse = new Fuse(titles, { threshold: 0.4, minMatchCharLength: 1 });
  return fuse
    .search(query, { limit: 8 })
    .map((r) => r.item);
}
