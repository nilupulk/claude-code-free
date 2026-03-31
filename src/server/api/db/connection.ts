/**
 * JSON-file-backed in-memory database.
 *
 * All reads are served from the in-memory map.
 * Writes are flushed to disk asynchronously (debounced 500 ms).
 * Swap this module for a Drizzle/SQLite adapter without changing callers.
 */

import { readFileSync, writeFile, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { emptyStore, type DbStore } from "./schema.js";

// ── Config ────────────────────────────────────────────────────────────────────

const DB_PATH = resolve(
  process.env.CC_DB_PATH ?? `${process.env.HOME ?? "/tmp"}/.claude/conversations.json`,
);

// ── Load ──────────────────────────────────────────────────────────────────────

function loadStore(): DbStore {
  try {
    const raw = readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DbStore>;
    const base = emptyStore();
    return {
      conversations: parsed.conversations ?? base.conversations,
      messages: parsed.messages ?? base.messages,
      toolUses: parsed.toolUses ?? base.toolUses,
      settings: parsed.settings ?? base.settings,
      processes: {}, // never restored — always ephemeral
    };
  } catch {
    return emptyStore();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _store: DbStore = loadStore();
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

/** The live in-memory store. Mutate directly; call flush() to persist. */
export function db(): DbStore {
  return _store;
}

// ── Flush ─────────────────────────────────────────────────────────────────────

/** Schedule a debounced write to disk. */
export function flush(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    const persisted = {
      conversations: _store.conversations,
      messages: _store.messages,
      toolUses: _store.toolUses,
      settings: _store.settings,
      // processes intentionally excluded
    };
    try {
      mkdirSync(dirname(DB_PATH), { recursive: true });
    } catch {
      // ignore
    }
    writeFile(DB_PATH, JSON.stringify(persisted, null, 2), "utf-8", (err) => {
      if (err) console.error("[db] flush error:", err);
    });
  }, 500);
}

// ── Reset (tests) ─────────────────────────────────────────────────────────────

export function resetDb(): void {
  _store = emptyStore();
}
