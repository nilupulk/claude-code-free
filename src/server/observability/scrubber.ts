/**
 * Sensitive data scrubbing utilities.
 * Removes or masks API keys, passwords, and file contents from log output.
 */

/** Matches Anthropic API keys: sk-ant-api03-... or similar variants */
const ANTHROPIC_KEY_RE = /\bsk-ant-[A-Za-z0-9\-_]{8,}\b/g;

/** Generic bearer / secret token patterns */
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-_.~+/]{20,}/gi;

/** Password-like field names */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "auth",
  "authorization",
  "credential",
  "credentials",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "private_key",
  "session_secret",
]);

/** Redact Anthropic API keys in a string, keeping a short suffix for debugging. */
export function scrubString(value: string): string {
  return value
    .replace(ANTHROPIC_KEY_RE, (match) => `sk-ant-...${match.slice(-4)}****`)
    .replace(BEARER_RE, "Bearer [REDACTED]");
}

/**
 * Recursively scrub an arbitrary object before it is logged.
 * - Sensitive field names → `[REDACTED]`
 * - String values containing API keys → masked
 * - Arrays recursively scrubbed
 */
export function scrubObject(input: unknown, depth = 0): unknown {
  if (depth > 10) return "[DEPTH_LIMIT]";

  if (typeof input === "string") return scrubString(input);

  if (Array.isArray(input)) return input.map((item) => scrubObject(item, depth + 1));

  if (input !== null && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = scrubObject(value, depth + 1);
      }
    }
    return out;
  }

  return input;
}

/**
 * Replace actual file content with a summary token.
 * Use when you would otherwise log the raw bytes of a file.
 */
export function scrubFileContent(filePath: string, sizeBytes: number): string {
  return `[FILE: ${filePath}, ${sizeBytes} bytes]`;
}

/**
 * pino `redact`-compatible path list for common sensitive headers / fields.
 * Pass as `redact.paths` in the pino config.
 */
export const PINO_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "body.password",
  "body.token",
  "body.secret",
  "context.apiKey",
  "context.password",
  "context.token",
  "context.secret",
];
