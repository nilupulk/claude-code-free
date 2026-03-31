import { randomBytes } from "crypto";

/** Generate a cryptographically random nonce for CSP script-src */
export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * Build a Content-Security-Policy header value.
 * The nonce is used for any inline scripts that legitimately need to run.
 */
export function buildCspHeader(nonce: string): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // unsafe-inline required for Tailwind and many CSS-in-JS solutions
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://api.anthropic.com",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/**
 * Static security response headers (CSP is separate because it requires a nonce).
 * Apply these to every response.
 */
export const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  // XSS-Protection is deprecated; CSP is the modern replacement
  ["X-XSS-Protection", "0"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
];

/** HSTS header value (only set over HTTPS in production) */
export const HSTS_VALUE = "max-age=31536000; includeSubDomains";
