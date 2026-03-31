/**
 * Sliding-window rate limiter.
 * Counters are per-user (falling back to IP) and per-route-group.
 *
 * Limits are configurable via environment variables:
 *   RATE_LIMIT_MESSAGES   — max messages per minute (default 20)
 *   RATE_LIMIT_REQUESTS   — max general API calls per minute (default 120)
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";

const MESSAGES_PER_MIN = parseInt(process.env.RATE_LIMIT_MESSAGES ?? "20", 10);
const REQUESTS_PER_MIN = parseInt(process.env.RATE_LIMIT_REQUESTS ?? "120", 10);
const WINDOW_MS = 60_000;

// ── In-memory counters ────────────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}, 60_000).unref();

// ── Core ──────────────────────────────────────────────────────────────────────

function keyFor(req: Request, bucket: string): string {
  const userId = (req as AuthenticatedRequest).user?.id;
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  return `${bucket}:${userId ?? ip}`;
}

function check(key: string, limit: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(key, entry);
  }
  entry.count += 1;
  const ok = entry.count <= limit;
  return { ok, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

// ── Exported middlewares ──────────────────────────────────────────────────────

/** Apply to message-send endpoint (stricter limit). */
export function rateLimitMessages(req: Request, res: Response, next: NextFunction): void {
  const { ok, retryAfter } = check(keyFor(req, "msg"), MESSAGES_PER_MIN);
  if (!ok) {
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: `Too many messages. Retry after ${retryAfter}s.`,
      },
    });
    return;
  }
  next();
}

/** Apply to general API routes. */
export function rateLimitRequests(req: Request, res: Response, next: NextFunction): void {
  const { ok, retryAfter } = check(keyFor(req, "req"), REQUESTS_PER_MIN);
  if (!ok) {
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry after ${retryAfter}s.`,
      },
    });
    return;
  }
  next();
}
