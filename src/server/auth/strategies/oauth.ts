/**
 * OAuth2 / OIDC authentication strategy.
 *
 * Re-exports the existing OAuthAdapter from the web layer so it can be
 * referenced uniformly through the `src/server/auth/strategies/` namespace.
 *
 * Supported providers (via generic OIDC discovery):
 *   Google   — OAUTH_ISSUER=https://accounts.google.com
 *   GitHub   — requires a GitHub-specific bridge (GitHub is not OIDC-native)
 *   Microsoft— OAUTH_ISSUER=https://login.microsoftonline.com/<tenant>/v2.0
 *   Okta     — OAUTH_ISSUER=https://<domain>.okta.com
 *   Auth0    — OAUTH_ISSUER=https://<domain>.auth0.com
 *
 * See `src/server/web/auth/oauth-auth.ts` for the full implementation.
 */
export { OAuthAdapter as OAuthStrategy } from "../../web/auth/oauth-auth.js";
