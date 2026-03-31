import type { IncomingMessage } from "http";
import type { Application, Request, Response, NextFunction } from "express";
import type { AuthAdapter, AuthUser, AuthenticatedRequest } from "./adapter.js";

/**
 * Token auth — the original single-token mode.
 *
 * If `AUTH_TOKEN` is set, callers must supply a matching token via the
 * `?token=` query parameter (WebSocket) or `Authorization: Bearer <token>`
 * header (HTTP). When `AUTH_TOKEN` is unset every caller is admitted as the
 * built-in "default" admin user.
 *
 * All callers share the same user identity. Use this provider for single-
 * user or trusted-network deployments where you just want a simple password.
 */
export class TokenAuthAdapter implements AuthAdapter {
  private readonly token: string | undefined;
  private readonly adminUsers: ReadonlySet<string>;

  constructor() {
    this.token = process.env.AUTH_TOKEN;
    this.adminUsers = new Set(
      (process.env.ADMIN_USERS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  authenticate(req: IncomingMessage): AuthUser | null {
    if (!this.token) {
      return { id: "default", isAdmin: true };
    }
    if (this.extractToken(req) === this.token) {
      return {
        id: "default",
        isAdmin: this.adminUsers.size === 0 || this.adminUsers.has("default"),
      };
    }
    return null;
  }

  setupRoutes(_app: Application): void {
    // Token auth needs no login/callback/logout routes.
  }

  requireAuth(req: Request, res: Response, next: NextFunction): void {
    const user = this.authenticate(req as unknown as IncomingMessage);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private extractToken(req: IncomingMessage): string | null {
    // 1. ?token= query param (used by WebSocket clients and simple links)
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const qp = url.searchParams.get("token");
    if (qp) return qp;

    // 2. Authorization: Bearer <token>
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) return auth.slice(7);

    // 3. Cookie cc_token (set by token-auth login page if any)
    const cookieHeader = req.headers.cookie ?? "";
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() === "cc_token") {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }

    return null;
  }
}
