/**
 * In-memory sliding window rate limiter.
 * Suitable for single-instance deployments. For multi-instance, replace the
 * store with Redis (e.g. using ioredis + sliding window Lua script).
 */

interface RateLimitEntry {
  /** Request timestamps within the current window (sorted ascending) */
  timestamps: number[];
  /** Absolute ms timestamp when the block expires (if currently blocked) */
  blockedUntil?: number;
}

export interface RateLimitConfig {
  /** Length of the sliding window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** How long to block after exceeding limit (default: windowMs) */
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAtMs: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupTimer: NodeJS.Timeout;

  constructor(private readonly config: RateLimitConfig) {
    // Periodically prune stale entries to prevent unbounded memory growth
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      Math.min(config.windowMs * 2, 60_000)
    );
    // Don't keep the Node.js process alive just for cleanup
    this.cleanupTimer.unref?.();
  }

  /** Check whether a request from `key` is allowed. Records the attempt. */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry: RateLimitEntry = this.store.get(key) ?? { timestamps: [] };

    // If currently hard-blocked, reject immediately
    if (entry.blockedUntil !== undefined && now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: entry.blockedUntil - now,
        resetAtMs: entry.blockedUntil,
      };
    }

    // Evict timestamps outside the sliding window
    const windowStart = now - this.config.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.config.maxRequests) {
      const blockDuration = this.config.blockDurationMs ?? this.config.windowMs;
      entry.blockedUntil = now + blockDuration;
      this.store.set(key, entry);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: blockDuration,
        resetAtMs: entry.blockedUntil,
      };
    }

    entry.timestamps.push(now);
    // Clear any expired block
    if (entry.blockedUntil !== undefined && now >= entry.blockedUntil) {
      delete entry.blockedUntil;
    }
    this.store.set(key, entry);

    const resetAtMs = (entry.timestamps[0] ?? now) + this.config.windowMs;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
      resetAtMs,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      const windowStart = now - this.config.windowMs;
      const active = entry.timestamps.filter((t) => t > windowStart);
      const blockExpired = !entry.blockedUntil || now >= entry.blockedUntil;
      if (active.length === 0 && blockExpired) {
        this.store.delete(key);
      } else {
        entry.timestamps = active;
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton rate limiters (one per endpoint category)
// ---------------------------------------------------------------------------

/** Global: 1000 requests/min per IP */
export const globalRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 1000,
});

/** Auth endpoints: 5 attempts/min per IP, 5-minute block */
export const authRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
  blockDurationMs: 5 * 60_000,
});

/** Chat/message sending: 30 messages/min per user */
export const messageRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});

/** File operations: 100 ops/min per user */
export const fileRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
});

/** Command execution: 20 commands/min per user */
export const commandRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the real client IP from forwarded headers */
export function getClientIp(headers: Headers | Record<string, string | undefined>): string {
  const get = (key: string) =>
    headers instanceof Headers ? headers.get(key) : headers[key];

  return (
    get("x-forwarded-for")?.split(",")[0]?.trim() ??
    get("x-real-ip") ??
    "unknown"
  );
}

/** Build a 429 Too Many Requests response with standard rate-limit headers */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      retryAfter: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAtMs / 1000)),
      },
    }
  );
}
