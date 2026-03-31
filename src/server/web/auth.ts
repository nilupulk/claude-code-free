import type { IncomingMessage } from "http";

/**
 * Validates the auth token from a WebSocket upgrade request.
 * If AUTH_TOKEN is not set, all connections are allowed.
 */
export function validateAuthToken(req: IncomingMessage): boolean {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    return true;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const token = url.searchParams.get("token");
  return token === authToken;
}

/**
 * Simple per-IP rate limiter for new connections.
 */
export class ConnectionRateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow = 5, windowMs = 60_000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  /**
   * Returns true if the connection should be allowed.
   */
  allow(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(ip) ?? [];

    // Prune old entries
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxPerWindow) {
      this.attempts.set(ip, recent);
      return false;
    }

    recent.push(now);
    this.attempts.set(ip, recent);
    return true;
  }

  /**
   * Periodically clean up stale entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, timestamps] of this.attempts) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) {
        this.attempts.delete(ip);
      } else {
        this.attempts.set(ip, recent);
      }
    }
  }
}
