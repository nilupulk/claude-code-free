// ─── Event Processor ──────────────────────────────────────────────────────────
//
// Validates incoming events, strips PII, and assigns server-side IDs
// before they are handed off to storage.

import { randomUUID } from "crypto";
import type { StoredEvent } from "./storage.js";

// ─── Known event names ────────────────────────────────────────────────────────

const ALLOWED_EVENTS = new Set([
  "conversation.created",
  "conversation.message_sent",
  "conversation.response_received",
  "conversation.exported",
  "conversation.shared",
  "tool.executed",
  "tool.approved",
  "tool.denied",
  "ui.theme_changed",
  "ui.sidebar_toggled",
  "ui.command_palette_used",
  "ui.keyboard_shortcut_used",
  "ui.file_viewer_opened",
  "ui.settings_changed",
  "performance.page_load",
  "performance.ttfb",
  "performance.streaming_latency",
  "error.api",
  "error.streaming",
  "error.ui",
]);

// ─── PII field names to scrub from properties ─────────────────────────────────

const PII_KEYS = new Set([
  "email",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "address",
  "ip",
  "ip_address",
  "user_agent",
  "password",
  "token",
  "secret",
  "api_key",
  "apiKey",
  "content",       // message content — never store verbatim
  "text",          // same
  "message",       // same
  "system_prompt", // potentially sensitive
]);

// ─── Validation ───────────────────────────────────────────────────────────────

interface RawEvent {
  name?: unknown;
  timestamp?: unknown;
  sessionId?: unknown;
  properties?: unknown;
}

function isValidRawEvent(e: unknown): e is RawEvent & { name: string; sessionId: string } {
  if (typeof e !== "object" || e === null) return false;
  const ev = e as RawEvent;
  return (
    typeof ev.name === "string" &&
    ALLOWED_EVENTS.has(ev.name) &&
    typeof ev.sessionId === "string" &&
    ev.sessionId.length > 0 &&
    ev.sessionId.length <= 64
  );
}

function sanitizeProperties(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) continue;
    // Only allow scalar values — no nested objects that could hide PII.
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      // Truncate strings to prevent abuse.
      result[key] = typeof value === "string" ? value.slice(0, 256) : value;
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ProcessResult {
  valid: StoredEvent[];
  rejected: number;
}

/**
 * Process a batch of raw events from the client.
 * Returns the sanitised events ready for storage and a count of rejected events.
 */
export function processBatch(rawEvents: unknown[]): ProcessResult {
  const now = Date.now();
  const valid: StoredEvent[] = [];
  let rejected = 0;

  for (const raw of rawEvents) {
    if (!isValidRawEvent(raw)) {
      rejected++;
      continue;
    }

    const timestamp =
      typeof raw.timestamp === "number" && raw.timestamp > 0 && raw.timestamp <= now + 5000
        ? raw.timestamp
        : now;

    valid.push({
      id: randomUUID(),
      name: raw.name,
      timestamp,
      sessionId: raw.sessionId,
      properties: sanitizeProperties(raw.properties),
      receivedAt: now,
    });
  }

  return { valid, rejected };
}
