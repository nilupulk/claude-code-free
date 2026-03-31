import { randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { AuthAdapter, AuthenticatedRequest, SessionStore } from "../web/auth/adapter.js";
import { touchSession } from "./session.js";

// ── CSRF ──────────────────────────────────────────────────────────────────────

const CSRF_COOKIE = "cc_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Parse the Cookie header into a key→value map. */
function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/**
 * CSRF protection middleware.
 *
 * Safe methods (GET/HEAD/OPTIONS) are passed through unconditionally.
 * For all other methods the middleware checks that the `X-CSRF-Token` request
 * header matches the `cc_csrf` cookie value (double-submit cookie pattern).
 *
 * Set the cookie with {@link setCsrfCookie} after session creation so the
 * browser can read it and include it in subsequent mutation requests.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie ?? "");
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  // Constant-time comparison to prevent timing attacks.
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(403).json({ error: "CSRF token mismatch" });
    return;
  }

  next();
}

/**
 * Set a new CSRF double-submit cookie on the response.
 *
 * The cookie is **not** HttpOnly (the browser JS must read it to copy it into
 * the `X-CSRF-Token` header). It is SameSite=Strict and Secure.
 */
export function setCsrfCookie(res: Response): void {
  const token = randomBytes(32).toString("hex");
  res.setHeader("Set-Cookie", [
    `${CSRF_COOKIE}=${token}; SameSite=Strict; Path=/; Secure`,
  ]);
}

// ── Auth middleware ───────────────────────────────────────────────────────────

/**
 * Creates an Express middleware that authenticates the request and slides the
 * session's `lastActiveAt` on every hit.
 *
 * Wraps the adapter's `requireAuth` so the rest of the pipeline only sees an
 * already-authenticated `req.user`.
 */
export function createAuthMiddleware(adapter: AuthAdapter, sessionStore?: SessionStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    adapter.requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      // Slide session expiration.
      if (sessionStore) {
        const id = sessionStore.getIdFromRequest(req as unknown as import("http").IncomingMessage);
        if (id) touchSession(id);
      }
      next();
    });
  };
}

// ── Login rate limiter ────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

export interface LoginRateLimiterOptions {
  /** Max requests per window before a 429 is returned. Default: 5. */
  maxPerWindow?: number;
  /** Window duration in ms. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Requests per window before a full account lockout. Default: 10. */
  lockoutThreshold?: number;
  /** Lockout duration in ms. Default: 900 000 (15 minutes). */
  lockoutMs?: number;
}

/**
 * In-memory rate limiter designed for login endpoints.
 *
 * Keyed by the client IP address (`req.ip`). Two tiers:
 *   1. Soft limit (`maxPerWindow`) → 429 until the window expires.
 *   2. Hard limit (`lockoutThreshold`) → 429 for `lockoutMs` (account lockout).
 *
 * Entries are pruned every 5 minutes to prevent unbounded growth.
 */
export function createLoginRateLimiter(options: LoginRateLimiterOptions = {}) {
  const {
    maxPerWindow = 5,
    windowMs = 60_000,
    lockoutThreshold = 10,
    lockoutMs = 15 * 60_000,
  } = options;

  const entries = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const cutoff = Date.now() - Math.max(windowMs, lockoutMs) * 2;
    for (const [key, entry] of entries) {
      const locked = entry.lockedUntil && entry.lockedUntil > Date.now();
      if (!locked && entry.windowStart < cutoff) entries.delete(key);
    }
  }, 5 * 60_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    const now = Date.now();

    let entry = entries.get(key);
    if (!entry) {
      entry = { count: 0, windowStart: now };
      entries.set(key, entry);
    }

    // Check hard lockout first.
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const retryAfter = Math.ceil((entry.lockedUntil - now) / 1_000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many failed login attempts. Try again later.",
        retryAfter,
      });
      return;
    }

    // Reset window if expired.
    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
      delete entry.lockedUntil;
    }

    entry.count++;

    // Escalate to lockout.
    if (entry.count > lockoutThreshold) {
      entry.lockedUntil = now + lockoutMs;
      const retryAfter = Math.ceil(lockoutMs / 1_000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many failed login attempts. Account locked for 15 minutes.",
        retryAfter,
      });
      return;
    }

    // Soft rate limit.
    if (entry.count > maxPerWindow) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1_000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfter,
      });
      return;
    }

    next();
  };
}

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * Simple CORS middleware restricted to an allowlist.
 *
 * Origins are read from the `ALLOWED_ORIGINS` environment variable (comma-
 * separated) plus any explicitly passed `extraOrigins`.
 */
export function createCorsMiddleware(extraOrigins: string[] = []) {
  const allowed = new Set([
    ...extraOrigins,
    ...(process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]);

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        `Content-Type, ${CSRF_HEADER}, Authorization`,
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
