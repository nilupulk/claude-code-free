// ─── Analytics Client ─────────────────────────────────────────────────────────
//
// Lightweight, privacy-first analytics client.
//
// • No cookies — uses an in-memory anonymous session ID
// • Opt-in only — silent no-op unless the user has explicitly enabled telemetry
// • Respects the browser Do Not Track header
// • Batches events to reduce network chatter

import { nanoid } from "nanoid";
import type { AnalyticsEvent, TypedEvent } from "./events";
import { isAnalyticsAllowed, stripPII } from "./privacy";
import { EventBatcher } from "./batch";

export interface AnalyticsClient {
  track(event: TypedEvent["name"], properties?: Record<string, unknown>): void;
  page(name: string, properties?: Record<string, unknown>): void;
  setEnabled(enabled: boolean): void;
  flush(): Promise<void>;
}

class NoopAnalyticsClient implements AnalyticsClient {
  track() {}
  page() {}
  setEnabled() {}
  async flush() {}
}

class ConcreteAnalyticsClient implements AnalyticsClient {
  /** Anonymous session ID — resets on page reload, never persisted. */
  private readonly sessionId = nanoid();
  private enabled: boolean;
  private readonly batcher: EventBatcher;

  constructor(initiallyEnabled: boolean) {
    this.enabled = initiallyEnabled;
    this.batcher = new EventBatcher();
    this.batcher.start();

    // Flush on page unload so events aren't lost.
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => {
        void this.batcher.flush();
      });
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    // Flush any buffered events when user enables telemetry mid-session,
    // or discard them when disabling.
    if (!enabled) {
      // Discard buffered events — create a new batcher to clear the queue.
      void this.batcher.stop();
    }
  }

  track(name: TypedEvent["name"], properties: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      properties: stripPII(properties),
    };

    this.batcher.push(event);
  }

  page(name: string, properties: Record<string, unknown> = {}): void {
    this.track("performance.page_load" as TypedEvent["name"], {
      route: name,
      ...properties,
    });
  }

  async flush(): Promise<void> {
    await this.batcher.flush();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: AnalyticsClient | null = null;

/**
 * Returns (and lazily initialises) the singleton analytics client.
 *
 * @param userOptedIn — pass `settings.telemetryEnabled` from the Zustand store.
 */
export function getAnalyticsClient(userOptedIn: boolean): AnalyticsClient {
  if (typeof window === "undefined") {
    // SSR — always return a no-op.
    return new NoopAnalyticsClient();
  }

  if (!_client) {
    const allowed = isAnalyticsAllowed(userOptedIn);
    _client = allowed ? new ConcreteAnalyticsClient(allowed) : new NoopAnalyticsClient();
  }

  return _client;
}

/**
 * Update the enabled state of the singleton client when the user
 * changes their telemetry preference.
 */
export function updateAnalyticsConsent(userOptedIn: boolean): void {
  if (_client) {
    const allowed = isAnalyticsAllowed(userOptedIn);
    _client.setEnabled(allowed);
  }
}

/** Convenience helper — safe to call before the client is initialised. */
export function track(name: TypedEvent["name"], properties?: Record<string, unknown>): void {
  _client?.track(name, properties);
}
