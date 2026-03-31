import type { Request, Response, NextFunction } from "express";

/**
 * CORS middleware.
 * Reads allowed origins from ALLOWED_ORIGINS env var (comma-separated).
 * Defaults to permissive (*) for dev.
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [];
const ALLOW_ALL = ALLOWED_ORIGINS.length === 0;

export function cors(req: Request, res: Response, next: NextFunction): void {
  const rawOrigin = req.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] ?? "" : rawOrigin ?? "";
  const allowed = ALLOW_ALL || ALLOWED_ORIGINS.includes(origin);

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ALL ? "*" : origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-Id",
    );
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (!ALLOW_ALL) {
      res.setHeader("Vary", "Origin");
    }
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
