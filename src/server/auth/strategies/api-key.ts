/**
 * API-key authentication strategy.
 *
 * Re-exports the existing ApiKeyAdapter from the web layer so it can be
 * referenced uniformly through the `src/server/auth/strategies/` namespace.
 *
 * See `src/server/web/auth/apikey-auth.ts` for the full implementation.
 */
export { ApiKeyAdapter as ApiKeyStrategy } from "../../web/auth/apikey-auth.js";
