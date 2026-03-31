// ─── Privacy Controls ─────────────────────────────────────────────────────────
//
// Analytics is opt-in only. We respect:
//   1. NEXT_PUBLIC_TELEMETRY_ENABLED=false  — global kill switch (env var)
//   2. navigator.doNotTrack === "1"         — browser DNT header
//   3. User opt-in flag in app settings     — default OFF

const TELEMETRY_GLOBALLY_ENABLED =
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== "false";

/**
 * Returns true if the browser's Do Not Track signal is active.
 * Only meaningful in a browser context.
 */
export function isDoNotTrackActive(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1";
}

/**
 * Whether analytics is permitted given all privacy controls.
 *
 * @param userOptedIn — the value of `settings.telemetryEnabled` from the store.
 */
export function isAnalyticsAllowed(userOptedIn: boolean): boolean {
  if (!TELEMETRY_GLOBALLY_ENABLED) return false;
  if (isDoNotTrackActive()) return false;
  return userOptedIn;
}

/**
 * Strips well-known PII fields from an event properties object.
 * Used as a last-resort safety net before transmitting events.
 */
export function stripPII(properties: Record<string, unknown>): Record<string, unknown> {
  const PII_KEYS = new Set([
    "email",
    "name",
    "full_name",
    "first_name",
    "last_name",
    "phone",
    "address",
    "ip",
    "ip_address",
    "user_agent",
    "password",
    "token",
    "secret",
    "api_key",
    "apiKey",
  ]);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!PII_KEYS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}
