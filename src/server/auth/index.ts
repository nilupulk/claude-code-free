/**
 * Shared authentication and authorization system.
 *
 * Provides a unified factory for all auth strategies, plus the /auth/me
 * introspection endpoint used by the frontend AuthProvider.
 *
 * Usage in pty-server.ts (or any Express app):
 *
 *   import { createAuthAdapter, setupAuth, SessionStore } from "./auth/index.js"
 *
 *   const store = new SessionStore(process.env.SESSION_SECRET ?? randomUUID())
 *   const strategy = (process.env.AUTH_STRATEGY ?? "api-key") as AuthStrategy
 *   const adapter = createAuthAdapter(strategy, store)
 *   setupAuth(app, adapter)
 *
 *   // Protect API routes:
 *   app.use("/api", createAuthMiddleware(adapter, store))
 *   app.use("/api/conversations", requirePermission("conversation:read"))
 */

import type { Application } from "express";
import type { IncomingMessage } from "http";

import { SessionStore } from "../web/auth/adapter.js";
import { TokenAuthAdapter } from "../web/auth/token-auth.js";
import { ApiKeyAdapter } from "../web/auth/apikey-auth.js";
import { OAuthAdapter } from "../web/auth/oauth-auth.js";
import { MagicLinkAdapter } from "./strategies/magic-link.js";
import type { AuthAdapter, AuthUser } from "../web/auth/adapter.js";

// ── Strategy types ────────────────────────────────────────────────────────────

export type AuthStrategy = "token" | "api-key" | "oauth" | "saml" | "magic-link";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Instantiate the auth adapter for the given strategy.
 *
 * Strategy is controlled by the `AUTH_STRATEGY` environment variable:
 *   token        — shared token or open access (default for single-user)
 *   api-key      — per-user Anthropic API key on login page
 *   oauth        — OAuth2/OIDC (Google, GitHub, Okta, Auth0, …)
 *   saml         — SAML 2.0 (Okta, Azure AD, Google Workspace, …)
 *   magic-link   — passwordless email link
 */
export function createAuthAdapter(strategy: AuthStrategy, store: SessionStore): AuthAdapter {
  switch (strategy) {
    case "token":
      return new TokenAuthAdapter();

    case "api-key":
      return new ApiKeyAdapter(store);

    case "oauth":
      return new OAuthAdapter(store);

    case "magic-link":
      return new MagicLinkAdapter(store);

    case "saml": {
      // Dynamic import keeps node-saml / samlify optional at the module level.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SamlAdapter } = require("./strategies/saml.js") as {
        SamlAdapter: new (store: SessionStore) => AuthAdapter;
      };
      return new SamlAdapter(store);
    }

    default:
      throw new Error(
        `Unknown AUTH_STRATEGY: "${strategy}". ` +
          "Valid values: token, api-key, oauth, saml, magic-link",
      );
  }
}

/**
 * Register auth routes and the /auth/me introspection endpoint.
 *
 * Call once during server startup, before any route middleware that depends
 * on authentication.
 */
export function setupAuth(app: Application, adapter: AuthAdapter): void {
  // Register strategy-specific routes (login, callback, logout, …).
  adapter.setupRoutes(app);

  /**
   * GET /auth/me — returns the current user's public profile.
   *
   * Used by the frontend AuthProvider to check authentication state on load
   * and after login redirects. Returns 401 when unauthenticated.
   *
   * The API key is intentionally stripped from the response.
   */
  app.get("/auth/me", (req, res) => {
    const user = adapter.authenticate(req as unknown as IncomingMessage);
    if (!user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    // Never expose the plaintext API key to the browser.
    const { apiKey: _stripped, ...publicUser } = user;
    res.json(publicUser);
  });
}

// ── Re-exports ────────────────────────────────────────────────────────────────

// Session store and types
export { SessionStore } from "../web/auth/adapter.js";
export type { AuthAdapter, AuthUser, AuthenticatedRequest, SessionData } from "../web/auth/adapter.js";

// Rich session layer
export { getSession, getSessionFromRequest, touchSession, pruneLastActive } from "./session.js";
export type { Session } from "./session.js";

// Permissions / RBAC
export {
  hasPermission,
  roleHasPermission,
  resolveRole,
  listPermissions,
  requirePermission,
  requireAdmin,
} from "./permissions.js";
export type { Role, Permission } from "./permissions.js";

// Middleware helpers
export {
  csrfMiddleware,
  setCsrfCookie,
  createAuthMiddleware,
  createLoginRateLimiter,
  createCorsMiddleware,
} from "./middleware.js";

// Encryption
export { encrypt, decrypt, deriveKey, generateEncryptionKey } from "./encryption.js";

// Strategy constructors (for advanced composition)
export { TokenAuthAdapter } from "../web/auth/token-auth.js";
export { ApiKeyAdapter } from "../web/auth/apikey-auth.js";
export { OAuthAdapter } from "../web/auth/oauth-auth.js";
export { MagicLinkAdapter } from "./strategies/magic-link.js";
