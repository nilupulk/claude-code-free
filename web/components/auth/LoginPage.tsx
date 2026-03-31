"use client";

import { useState } from "react";
import { ApiKeyInput } from "./ApiKeyInput";
import { OAuthButtons, OAUTH_PROVIDERS } from "./OAuthButtons";
import { getCsrfToken, useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Which authentication strategy the server is running. */
export type LoginMode = "api-key" | "oauth" | "magic-link" | "token";

interface LoginPageProps {
  mode?: LoginMode;
  /** Server-supplied error (e.g. "Invalid API key"). */
  serverError?: string;
  /** Where to redirect after successful login. */
  next?: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Full-page login UI that adapts to the configured auth strategy.
 *
 * - `api-key`   — shows the Anthropic API key input form
 * - `oauth`     — shows OAuth provider buttons
 * - `magic-link`— shows email input for passwordless login
 * - `token`     — not relevant (token auth doesn't need a UI)
 *
 * The `mode` prop defaults to `"api-key"`. Pass it based on the server's
 * `AUTH_STRATEGY` environment variable (surfaced via an API call or
 * `NEXT_PUBLIC_AUTH_STRATEGY` env var in Next.js).
 */
export function LoginPage({
  mode = "api-key",
  serverError,
  next,
  className,
}: LoginPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(serverError);
  const [magicSent, setMagicSent] = useState(false);
  const { refresh } = useAuth();

  // ── API-key submit (fetch-based, no full-page reload) ──────────────────────

  const handleApiKeySubmit = async (key: string) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ api_key: key });
      if (next) params.set("next", next);

      const res = await fetch(`/auth/login?${next ? `next=${encodeURIComponent(next)}` : ""}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-csrf-token": getCsrfToken() ?? "",
        },
        body: params.toString(),
        redirect: "manual", // handle redirects manually
      });

      if (res.ok || res.type === "opaqueredirect") {
        // Session cookie is now set — refresh auth context and navigate.
        await refresh();
        window.location.href = next ?? "/";
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed. Check your API key and try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Magic-link submit ──────────────────────────────────────────────────────

  const handleMagicLinkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = e.currentTarget;
    const email = (new FormData(form).get("email") as string | null)?.trim() ?? "";

    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email }).toString(),
      });
      if (res.ok || res.redirected) {
        setMagicSent(true);
      } else {
        setError("Failed to send link. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-surface-950 px-4",
        className,
      )}
    >
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20 ring-1 ring-brand-500/30">
            <svg
              className="h-6 w-6 text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-surface-50">Claude Code</h1>
          <p className="mt-1 text-sm text-surface-400">
            {mode === "api-key" && "Sign in with your Anthropic API key"}
            {mode === "oauth" && "Sign in to continue"}
            {mode === "magic-link" && "Sign in with a magic link"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-xl">
          {mode === "api-key" && (
            <ApiKeyInput
              error={error}
              loading={submitting}
              onSubmit={(key) => void handleApiKeySubmit(key)}
            />
          )}

          {mode === "oauth" && (
            <div className="flex flex-col gap-4">
              {error && (
                <p className="rounded-md bg-red-950/50 px-3 py-2 text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
              <OAuthButtons providers={OAUTH_PROVIDERS} />
            </div>
          )}

          {mode === "magic-link" && (
            <>
              {magicSent ? (
                <div className="rounded-md border border-green-800/50 bg-green-950/30 px-4 py-3 text-sm text-green-300">
                  <p className="font-medium">Check your inbox</p>
                  <p className="mt-1 text-green-400/80">
                    A sign-in link has been sent. It expires in 15 minutes and can only be used once.
                  </p>
                </div>
              ) : (
                <form onSubmit={(e) => void handleMagicLinkSubmit(e)} className="flex flex-col gap-3">
                  {error && (
                    <p className="text-xs text-red-400" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="magic-email" className="text-sm text-surface-400">
                      Email address
                    </label>
                    <input
                      id="magic-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className="w-full rounded-md border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-9 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? "Sending…" : "Send sign-in link"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-surface-600">
          Claude Code — self-hosted
        </p>
      </div>
    </div>
  );
}
