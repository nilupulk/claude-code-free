"use client";

import { cn } from "@/lib/utils";

// ── Provider definitions ──────────────────────────────────────────────────────

export interface OAuthProvider {
  id: string;
  label: string;
  /** Login URL — defaults to /auth/login?provider=<id> */
  href?: string;
  icon: React.ReactNode;
}

/** Built-in provider set. Extend or replace via the `providers` prop. */
export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "github",
    label: "Continue with GitHub",
    icon: <GitHubIcon />,
  },
  {
    id: "google",
    label: "Continue with Google",
    icon: <GoogleIcon />,
  },
  {
    id: "microsoft",
    label: "Continue with Microsoft",
    icon: <MicrosoftIcon />,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface OAuthButtonsProps {
  providers?: OAuthProvider[];
  className?: string;
  /** Override the base login URL. Default: /auth/login */
  loginBase?: string;
}

/**
 * Renders OAuth provider sign-in buttons.
 *
 * Each button navigates to `/auth/login?provider=<id>`, which the server
 * redirects to the identity provider's authorization URL.
 */
export function OAuthButtons({
  providers = OAUTH_PROVIDERS,
  className,
  loginBase = "/auth/login",
}: OAuthButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {providers.map((provider) => {
        const href = provider.href ?? `${loginBase}?provider=${provider.id}`;
        return (
          <a
            key={provider.id}
            href={href}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md border border-surface-700 bg-surface-900 px-4",
              "text-sm font-medium text-surface-100 transition-colors",
              "hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            )}
          >
            <span className="h-4 w-4 shrink-0">{provider.icon}</span>
            <span>{provider.label}</span>
          </a>
        );
      })}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.4 24H0V12.6h11.4V24z" fill="#F1511B" />
      <path d="M24 24H12.6V12.6H24V24z" fill="#80CC28" />
      <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#00ADEF" />
      <path d="M24 11.4H12.6V0H24v11.4z" fill="#FBBC09" />
    </svg>
  );
}
