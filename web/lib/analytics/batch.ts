// ─── Event Batcher ────────────────────────────────────────────────────────────
//
// Buffers events in memory and flushes them to the server either when
// MAX_BATCH_SIZE events have accumulated or after FLUSH_INTERVAL_MS.

import type { AnalyticsEvent, EventBatch } from "./events";

const MAX_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 30_000;

export class EventBatcher {
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly endpoint: string;
  private readonly clientVersion: string;

  constructor(endpoint = "/api/analytics/events", clientVersion = "1.0") {
    this.endpoint = endpoint;
    this.clientVersion = clientVersion;
  }

  /** Start the periodic flush timer. Call once on initialisation. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Stop the flush timer and flush any remaining events. */
  async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  /** Add one event to the buffer; flushes automatically when full. */
  push(event: AnalyticsEvent): void {
    this.queue.push(event);
    if (this.queue.length >= MAX_BATCH_SIZE) {
      void this.flush();
    }
  }

  /** Flush the current buffer to the server. */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch: EventBatch = {
      events: this.queue.splice(0),
      clientVersion: this.clientVersion,
    };

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive ensures the request completes even if the page unloads
        keepalive: true,
        body: JSON.stringify(batch),
      });
    } catch {
      // Silently discard on network failure — analytics must never break the app.
    }
  }

  /** Return how many events are currently buffered (useful for tests). */
  get size(): number {
    return this.queue.length;
  }
}
