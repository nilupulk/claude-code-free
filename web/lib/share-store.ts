/**
 * Server-side in-memory share store.
 * In production, replace with a database (e.g. Redis, Postgres).
 * Module-level singleton persists for the duration of the Node.js process.
 */

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import type { Conversation } from "./types";

// ---------------------------------------------------------------------------
// Password hashing (scrypt + timing-safe compare)
// ---------------------------------------------------------------------------

const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_BYTES = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_BYTES, SCRYPT_PARAMS).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const colonIdx = storedHash.indexOf(":");
  if (colonIdx === -1) return false;
  const salt = storedHash.slice(0, colonIdx);
  const hash = storedHash.slice(colonIdx + 1);
  try {
    const derived = scryptSync(password, salt, SCRYPT_KEY_BYTES, SCRYPT_PARAMS);
    const stored = Buffer.from(hash, "hex");
    // Constant-time comparison prevents timing attacks
    return derived.length === stored.length && timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export type ShareVisibility = "public" | "unlisted" | "password";
export type ShareExpiry = "1h" | "24h" | "7d" | "30d" | "never";

export interface StoredShare {
  id: string;
  conversationId: string;
  conversation: Conversation;
  visibility: ShareVisibility;
  /** scrypt hash of the password in "salt:hash" format (hex-encoded) */
  passwordHash?: string;
  expiry: ShareExpiry;
  expiresAt?: number;
  createdAt: number;
}

const EXPIRY_MS: Record<ShareExpiry, number | null> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  never: null,
};

// Module-level singleton
const store = new Map<string, StoredShare>();

export function createShare(
  shareId: string,
  params: {
    conversation: Conversation;
    visibility: ShareVisibility;
    password?: string;
    expiry: ShareExpiry;
  }
): StoredShare {
  const expiryMs = EXPIRY_MS[params.expiry];
  const now = Date.now();

  const entry: StoredShare = {
    id: shareId,
    conversationId: params.conversation.id,
    conversation: params.conversation,
    visibility: params.visibility,
    passwordHash: params.password ? hashPassword(params.password) : undefined,
    expiry: params.expiry,
    expiresAt: expiryMs !== null ? now + expiryMs : undefined,
    createdAt: now,
  };

  store.set(shareId, entry);
  return entry;
}

export function getShare(shareId: string): StoredShare | null {
  const entry = store.get(shareId);
  if (!entry) return null;

  // Check expiry
  if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
    store.delete(shareId);
    return null;
  }

  return entry;
}

export function verifySharePassword(shareId: string, password: string): boolean {
  const entry = store.get(shareId);
  if (!entry || entry.visibility !== "password" || !entry.passwordHash) return false;
  return verifyPassword(password, entry.passwordHash);
}

export function revokeShare(shareId: string): boolean {
  return store.delete(shareId);
}

export function getSharesByConversation(conversationId: string): StoredShare[] {
  return Array.from(store.values()).filter(
    (s) => s.conversationId === conversationId
  );
}
