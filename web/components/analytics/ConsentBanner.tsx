"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/lib/store";
import { isDoNotTrackActive } from "@/lib/analytics/privacy";

const DISMISSED_KEY = "analytics-consent-dismissed";

/**
 * One-time opt-in banner.
 *
 * Shown the first time a user visits, unless:
 * - they already have a stored preference (`telemetryEnabled` set explicitly)
 * - the browser's Do Not Track signal is active
 * - `NEXT_PUBLIC_TELEMETRY_ENABLED=false` is set
 *
 * Renders nothing once dismissed.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const { settings, updateSettings } = useChatStore();

  useEffect(() => {
    // Never show if telemetry is globally disabled.
    if (process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "false") return;
    // Never show if DNT is active.
    if (isDoNotTrackActive()) return;
    // Never show if the user already made a choice (key exists in localStorage).
    if (typeof localStorage !== "undefined" && localStorage.getItem(DISMISSED_KEY)) return;

    setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    updateSettings({ telemetryEnabled: true });
    dismiss();
  }

  function decline() {
    updateSettings({ telemetryEnabled: false });
    dismiss();
  }

  function dismiss() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur"
    >
      <p className="mb-1 text-sm font-medium text-foreground">
        Help improve Claude Code
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        We&apos;d like to collect anonymous usage data to understand which features are most
        helpful. No personal information, message content, or file data is ever collected.
        You can change this at any time in Settings → Privacy.
      </p>
      <div className="flex gap-2">
        <button
          onClick={accept}
          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Allow analytics
        </button>
        <button
          onClick={decline}
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
