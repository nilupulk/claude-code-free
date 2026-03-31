// ─── Analytics Aggregator ─────────────────────────────────────────────────────
//
// Computes daily / weekly / range summaries from raw stored events.
// All aggregation is done in-process — no external query engine needed.

import type { StoredEvent } from "./storage.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyBucket {
  date: string; // YYYY-MM-DD
  sessions: number;
  events: number;
  messages: number;
  errors: number;
}

export interface ModelUsage {
  model: string;
  count: number;
}

export interface ToolUsage {
  tool_name: string;
  count: number;
  errors: number;
  avg_duration_ms: number;
}

export interface AnalyticsSummary {
  period: { start: number; end: number; days: number };
  totals: {
    sessions: number;
    events: number;
    messages: number;
    errors: number;
    avg_response_ms: number;
    avg_tokens_per_response: number;
  };
  daily: DailyBucket[];
  models: ModelUsage[];
  tools: ToolUsage[];
  error_rate: number; // 0–1
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ─── Core aggregation ─────────────────────────────────────────────────────────

export function aggregate(events: StoredEvent[], days: number): AnalyticsSummary {
  const now = Date.now();
  const start = now - days * 86_400_000;

  const sessionSet = new Set<string>();
  const dailyMap = new Map<string, DailyBucket>();
  const modelMap = new Map<string, number>();
  const toolMap = new Map<string, { count: number; errors: number; totalMs: number }>();

  let totalMessages = 0;
  let totalErrors = 0;
  let totalResponseMs = 0;
  let responseCount = 0;
  let totalTokens = 0;
  let tokenCount = 0;

  for (const e of events) {
    if (e.timestamp < start) continue;

    sessionSet.add(e.sessionId);

    // Daily bucket
    const day = toYMD(e.timestamp);
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { date: day, sessions: 0, events: 0, messages: 0, errors: 0 });
    }
    const bucket = dailyMap.get(day)!;
    bucket.events++;

    // ── Conversation events ────────────────────────────────────────────────

    if (e.name === "conversation.message_sent") {
      totalMessages++;
      bucket.messages++;
    }

    if (e.name === "conversation.created") {
      const model = str(e.properties.model);
      if (model) modelMap.set(model, (modelMap.get(model) ?? 0) + 1);
    }

    if (e.name === "conversation.response_received") {
      const ms = num(e.properties.duration_ms);
      const tokens = num(e.properties.tokens);
      if (ms > 0) { totalResponseMs += ms; responseCount++; }
      if (tokens > 0) { totalTokens += tokens; tokenCount++; }
    }

    // ── Tool events ────────────────────────────────────────────────────────

    if (e.name === "tool.executed") {
      const toolName = str(e.properties.tool_name);
      const durationMs = num(e.properties.duration_ms);
      const isError = e.properties.status === "error";

      if (toolName) {
        const t = toolMap.get(toolName) ?? { count: 0, errors: 0, totalMs: 0 };
        t.count++;
        if (isError) t.errors++;
        t.totalMs += durationMs;
        toolMap.set(toolName, t);
      }
    }

    // ── Error events ───────────────────────────────────────────────────────

    if (e.name.startsWith("error.")) {
      totalErrors++;
      bucket.errors++;
    }
  }

  // Count unique sessions per day (approximation using per-day set tracking)
  const dailySessionMap = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.timestamp < start) continue;
    const day = toYMD(e.timestamp);
    if (!dailySessionMap.has(day)) dailySessionMap.set(day, new Set());
    dailySessionMap.get(day)!.add(e.sessionId);
  }
  for (const [day, sessions] of dailySessionMap) {
    const bucket = dailyMap.get(day);
    if (bucket) bucket.sessions = sessions.size;
  }

  // Sort daily buckets ascending
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Top models
  const models: ModelUsage[] = Array.from(modelMap.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top tools
  const tools: ToolUsage[] = Array.from(toolMap.entries())
    .map(([tool_name, t]) => ({
      tool_name,
      count: t.count,
      errors: t.errors,
      avg_duration_ms: t.count > 0 ? Math.round(t.totalMs / t.count) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalEvents = events.filter((e) => e.timestamp >= start).length;

  return {
    period: { start, end: now, days },
    totals: {
      sessions: sessionSet.size,
      events: totalEvents,
      messages: totalMessages,
      errors: totalErrors,
      avg_response_ms: responseCount > 0 ? Math.round(totalResponseMs / responseCount) : 0,
      avg_tokens_per_response: tokenCount > 0 ? Math.round(totalTokens / tokenCount) : 0,
    },
    daily,
    models,
    tools,
    error_rate: totalEvents > 0 ? totalErrors / totalEvents : 0,
  };
}
