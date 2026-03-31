/**
 * Auth middleware for the REST API.
 *
 * Supports two modes:
 *   - Bearer token  (AUTH_PROVIDER=token, checked against AUTH_TOKEN env var)
 *   - API key pass-through (AUTH_PROVIDER=apikey, key forwarded to Anthropic)
 *
 * When AUTH_PROVIDER is unset or "none", auth is skipped (dev mode).
 * Integrates with the existing auth adapters from the PTY server.
 */

import type { Request, Response, NextFunction } from "express";

const AUTH_PROVIDER = process.env.AUTH_PROVIDER ?? "none";
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// ── Public type ───────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  isAdmin: boolean;
  apiKey?: string; // Anthropic API key (from header or env)
}

export interface AuthenticatedRequest extends Request {
  user: ApiUser;
}

// ── Bearer-token extraction helper ────────────────────────────────────────────

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  // Also accept query param for SSE clients that can't set headers.
  if (typeof req.query.token === "string") return req.query.token;
  return null;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (AUTH_PROVIDER === "none") {
    (req as AuthenticatedRequest).user = { id: "default", isAdmin: true };
    next();
    return;
  }

  const token = extractBearer(req);

  if (AUTH_PROVIDER === "token") {
    if (!AUTH_TOKEN) {
      // Token auth enabled but no token configured — pass through.
      (req as AuthenticatedRequest).user = { id: "default", isAdmin: true };
      next();
      return;
    }
    if (!token || token !== AUTH_TOKEN) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Invalid or missing auth token" },
      });
      return;
    }
    (req as AuthenticatedRequest).user = { id: "default", isAdmin: true };
    next();
    return;
  }

  if (AUTH_PROVIDER === "apikey") {
    // The API key IS the auth credential; forward it to Claude calls.
    const apiKey = token ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Anthropic API key required" },
      });
      return;
    }
    (req as AuthenticatedRequest).user = { id: "apikey-user", isAdmin: false, apiKey };
    next();
    return;
  }

  // Unknown provider — deny by default.
  res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthenticated" } });
}

/** Optional middleware — attach user if auth header present, don't reject if absent. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (AUTH_PROVIDER === "none") {
    (req as AuthenticatedRequest).user = { id: "default", isAdmin: true };
    next();
    return;
  }

  const token = extractBearer(req);
  if (token) {
    (req as AuthenticatedRequest).user = {
      id: "default",
      isAdmin: false,
      apiKey: AUTH_PROVIDER === "apikey" ? token : undefined,
    };
  } else {
    (req as AuthenticatedRequest).user = { id: "anonymous", isAdmin: false };
  }
  next();
}

/** Middleware that restricts a route to admin users. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.isAdmin) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    return;
  }
  next();
}
