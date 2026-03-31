"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

interface ApiKeyInputProps {
  /** Called with the validated key when the user submits. */
  onSubmit?: (key: string) => void;
  /** Server-side error message to display. */
  error?: string;
  /** Show a loading spinner on the button. */
  loading?: boolean;
  /** Additional class names for the root element. */
  className?: string;
}

/**
 * Anthropic API key entry form.
 *
 * Renders an `<input type="password">` for the API key plus a submit button.
 * Performs basic client-side format validation (must start with `sk-ant-`)
 * before calling `onSubmit`.
 *
 * The form posts to `/auth/login` when used standalone, or calls `onSubmit`
 * when used as a controlled component inside LoginPage.
 */
export function ApiKeyInput({ onSubmit, error, loading = false, className }: ApiKeyInputProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      e.preventDefault();
      setLocalError(null);
      if (!value.startsWith("sk-ant-")) {
        setLocalError("API keys must start with sk-ant-");
        return;
      }
      onSubmit(value);
    }
    // Otherwise let the native form POST to /auth/login.
  };

  const displayError = localError ?? error;

  return (
    <form
      method="POST"
      action="/auth/login"
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-3", className)}
      aria-label="Anthropic API key sign-in"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="api_key" className="text-sm text-surface-400">
          Anthropic API Key
        </label>
        <input
          id="api_key"
          name="api_key"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          autoFocus
          required
          className={cn(
            "w-full rounded-md border bg-surface-900 px-3 py-2 text-sm text-surface-100",
            "placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500",
            displayError ? "border-red-500" : "border-surface-700",
          )}
          aria-describedby={displayError ? "api-key-error" : "api-key-hint"}
          aria-invalid={!!displayError}
        />
        {displayError ? (
          <p id="api-key-error" className="text-xs text-red-400" role="alert">
            {displayError}
          </p>
        ) : (
          <p id="api-key-hint" className="text-xs text-surface-500">
            Your key is stored encrypted and never sent back to the browser.{" "}
            <a
              href="https://console.anthropic.com/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 underline-offset-2 hover:underline"
            >
              Get a key →
            </a>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !value}
        className={cn(
          "flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-white",
          "bg-brand-600 hover:bg-brand-700 active:bg-brand-800",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          "disabled:pointer-events-none disabled:opacity-50 transition-colors",
        )}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
