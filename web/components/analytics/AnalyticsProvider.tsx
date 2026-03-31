"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useChatStore } from "@/lib/store";
import {
  getAnalyticsClient,
  updateAnalyticsConsent,
  type AnalyticsClient,
} from "@/lib/analytics/client";
import type { TypedEvent } from "@/lib/analytics/events";

// ─── Context ──────────────────────────────────────────────────────────────────

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const telemetryEnabled = useChatStore((s) => s.settings.telemetryEnabled);
  const clientRef = useRef<AnalyticsClient | null>(null);

  // Initialise or update consent whenever the setting changes.
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getAnalyticsClient(telemetryEnabled);
    } else {
      updateAnalyticsConsent(telemetryEnabled);
    }
  }, [telemetryEnabled]);

  // Flush before the page unloads.
  useEffect(() => {
    return () => {
      void clientRef.current?.flush();
    };
  }, []);

  return (
    <AnalyticsContext.Provider value={clientRef.current}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns an analytics `track` function bound to the current consent state.
 * Safe to call unconditionally — it's a no-op when telemetry is disabled.
 */
export function useAnalytics() {
  const telemetryEnabled = useChatStore((s) => s.settings.telemetryEnabled);
  const client = getAnalyticsClient(telemetryEnabled);

  return {
    track(name: TypedEvent["name"], properties?: Record<string, unknown>) {
      client.track(name, properties);
    },
  };
}
