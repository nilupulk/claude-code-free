import type { IncomingMessage } from "http";
import type { SessionStore } from "../web/auth/adapter.js";
import type { Role } from "./permissions.js";

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Rich session view used by higher-level server code.
 * Returned by {@link getSession}; the raw `SessionData` stays internal to the
 * session store.
 */
export interface Session {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  /** Decrypted Anthropic API key (empty string if not using apikey strategy). */
  anthropicApiKey: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
}

// ── Last-active tracking ──────────────────────────────────────────────────────

// Stored separately because SessionData doesn't carry lastActiveAt.
const lastActiveMap = new Map<string, Date>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return a rich {@link Session} for a given session ID, or null if the
 * session doesn't exist / has expired.
 *
 * Also touches `lastActiveAt` so callers don't need a separate step.
 */
export function getSession(store: SessionStore, sessionId: string): Session | null {
  const data = store.get(sessionId);
  if (!data) {
    lastActiveMap.delete(sessionId);
    return null;
  }

  const now = new Date();
  lastActiveMap.set(sessionId, now);

  const apiKey = data.encryptedApiKey ? (store.decrypt(data.encryptedApiKey) ?? "") : "";

  return {
    id: sessionId,
    userId: data.userId,
    email: data.email ?? "",
    name: data.name ?? data.userId,
    role: data.isAdmin ? "admin" : "user",
    anthropicApiKey: apiKey,
    createdAt: new Date(data.createdAt),
    expiresAt: new Date(data.expiresAt),
    lastActiveAt: now,
  };
}

/**
 * Extract the session ID from the request's signed cookie, then return the
 * full {@link Session}. Returns null if unauthenticated.
 */
export function getSessionFromRequest(store: SessionStore, req: IncomingMessage): Session | null {
  const id = store.getIdFromRequest(req);
  if (!id) return null;
  return getSession(store, id);
}

/**
 * Update the `lastActiveAt` timestamp for an active session (sliding
 * expiration). Call this on every authenticated API request.
 */
export function touchSession(sessionId: string): void {
  lastActiveMap.set(sessionId, new Date());
}

/**
 * Remove all lastActive entries for session IDs that are no longer in the
 * store. Call periodically to prevent unbounded memory growth.
 */
export function pruneLastActive(activeIds: Iterable<string>): void {
  const valid = new Set(activeIds);
  for (const id of lastActiveMap.keys()) {
    if (!valid.has(id)) lastActiveMap.delete(id);
  }
}

/**
 * Get only the `lastActiveAt` date for a session without constructing the
 * full Session object.
 */
export function getLastActive(sessionId: string): Date | undefined {
  return lastActiveMap.get(sessionId);
}
