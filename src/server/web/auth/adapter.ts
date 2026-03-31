import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { Application, Request, Response, NextFunction } from "express";

// ── Public types ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  isAdmin: boolean;
  /** Decrypted Anthropic API key (only present for apikey auth provider) */
  apiKey?: string;
}

export interface SessionData {
  userId: string;
  email?: string;
  name?: string;
  isAdmin: boolean;
  /** AES-256-GCM encrypted Anthropic API key */
  encryptedApiKey?: string;
  createdAt: number;
  expiresAt: number;
}

/** Augmented Express request with authenticated user attached. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/** Auth adapter — pluggable authentication strategy. */
export interface AuthAdapter {
  /**
   * Authenticate an IncomingMessage (HTTP or WebSocket upgrade).
   * Returns null when the request is unauthenticated.
   */
  authenticate(req: IncomingMessage): AuthUser | null;

  /**
   * Register login/callback/logout routes on the Express app.
   * Called once during server startup before any requests arrive.
   */
  setupRoutes(app: Application): void;

  /**
   * Express middleware that rejects unauthenticated requests.
   * For browser clients it redirects to /auth/login; for API clients it
   * returns 401 JSON.
   */
  requireAuth(req: Request, res: Response, next: NextFunction): void;
}

// ── Cookie helpers ──────────────────────────────────────────────────────────

const COOKIE_NAME = "cc_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

// ── SessionStore ────────────────────────────────────────────────────────────

/**
 * In-memory server-side session store.
 *
 * Sessions are identified by a random UUID stored in a signed HttpOnly cookie.
 * Sensitive values (API keys) are stored encrypted with AES-256-GCM.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionData>();
  /** 32-byte key derived from the session secret. */
  private readonly key: Buffer;

  constructor(secret: string) {
    // Derive a stable 32-byte key so the same secret always produces the
    // same key (important if the process restarts while cookies are live).
    const hmac = createHmac("sha256", secret);
    hmac.update("cc-session-key-v1");
    this.key = hmac.digest();

    // Purge expired sessions every 5 minutes.
    setInterval(() => this.cleanup(), 5 * 60_000).unref();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  create(data: Omit<SessionData, "createdAt" | "expiresAt">): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, {
      ...data,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return id;
  }

  get(id: string): SessionData | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }
    return s;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  // ── Cookie signing ────────────────────────────────────────────────────────

  sign(id: string): string {
    const hmac = createHmac("sha256", this.key);
    hmac.update(id);
    return `${id}.${hmac.digest("base64url")}`;
  }

  /**
   * Verifies the HMAC and returns the raw session ID, or null on failure.
   * Uses constant-time comparison to prevent timing attacks.
   */
  unsign(signed: string): string | null {
    const dot = signed.lastIndexOf(".");
    if (dot === -1) return null;
    const id = signed.slice(0, dot);
    const provided = signed.slice(dot + 1);

    const hmac = createHmac("sha256", this.key);
    hmac.update(id);
    const expected = hmac.digest("base64url");

    if (provided.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < provided.length; i++) {
      diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0 ? id : null;
  }

  // ── Request / response helpers ────────────────────────────────────────────

  /** Returns the session data for the current request, or null. */
  getFromRequest(req: IncomingMessage): SessionData | null {
    const cookies = parseCookies(req.headers.cookie ?? "");
    const signed = cookies[COOKIE_NAME];
    if (!signed) return null;
    const id = this.unsign(signed);
    if (!id) return null;
    return this.get(id) ?? null;
  }

  /** Returns the raw session ID from the request cookie, or null. */
  getIdFromRequest(req: IncomingMessage): string | null {
    const cookies = parseCookies(req.headers.cookie ?? "");
    const signed = cookies[COOKIE_NAME];
    if (!signed) return null;
    return this.unsign(signed);
  }

  setCookie(res: ServerResponse, sessionId: string): void {
    const signed = this.sign(sessionId);
    const maxAge = Math.floor(SESSION_TTL_MS / 1000);
    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=${encodeURIComponent(signed)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    ]);
  }

  clearCookie(res: ServerResponse): void {
    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    ]);
  }

  // ── Encryption ────────────────────────────────────────────────────────────

  /** Encrypts a plaintext string with AES-256-GCM for session storage. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: iv(12) | tag(16) | ciphertext
    return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  }

  /** Decrypts a value produced by {@link encrypt}. Returns null on failure. */
  decrypt(encoded: string): string | null {
    try {
      const buf = Buffer.from(encoded, "base64url");
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const ciphertext = buf.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
    } catch {
      return null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private cleanup(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now > s.expiresAt) this.sessions.delete(id);
    }
  }
}
