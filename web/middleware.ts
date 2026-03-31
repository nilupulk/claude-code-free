import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** HTTP methods that do not mutate state — exempt from CSRF origin check */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Generate a per-request CSP nonce using Web Crypto (Edge Runtime compatible) */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // In dev, React Fast Refresh requires 'unsafe-eval'; omit it in production
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and CSS-in-JS require unsafe-inline for styles
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // WebSocket + SSE to same origin; Anthropic API for direct client calls
    "connect-src 'self' wss: https://api.anthropic.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  // ── CSRF: verify Origin matches Host for all state-changing requests ───────
  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    if (origin && host) {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return new NextResponse(
          JSON.stringify({ error: "CSRF check failed: invalid origin header" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (originHost !== host) {
        return new NextResponse(
          JSON.stringify({ error: "CSRF check failed: origin mismatch" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  // ── Generate per-request nonce, pass it to server components via header ───
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Security headers on every response ────────────────────────────────────
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Deprecated — CSP is the modern replacement; set to 0 to disable browser heuristics
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS — only set on HTTPS (Vercel always uses HTTPS in production)
  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  // Skip static assets — headers already set via vercel.json / next.config.ts
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
