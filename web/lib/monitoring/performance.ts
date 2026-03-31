/**
 * Custom performance marks and measures for the Claude Code web app.
 *
 * Wraps the Performance API with typed helpers so you can track:
 *   - Time to first message render
 *   - Streaming start latency (user sends → first token arrives)
 *   - Input-to-display latency (keydown → response visible)
 *
 * All measurements are reported via a configurable reporter function so you
 * can route them to an analytics endpoint, the console, or Sentry.
 */

// ── Mark names ────────────────────────────────────────────────────────────────

export const Marks = {
  // Navigation
  APP_INIT: "app:init",
  APP_READY: "app:ready",

  // Conversation
  CONVERSATION_START: "conversation:start",
  FIRST_MESSAGE_RENDER: "conversation:first_message_render",

  // Streaming
  STREAM_REQUEST_START: (id: string) => `stream:${id}:request_start`,
  STREAM_FIRST_TOKEN: (id: string) => `stream:${id}:first_token`,
  STREAM_COMPLETE: (id: string) => `stream:${id}:complete`,

  // Input latency
  INPUT_SUBMIT: (id: string) => `input:${id}:submit`,
  RESPONSE_DISPLAYED: (id: string) => `input:${id}:displayed`,
} as const;

export const Measures = {
  APP_INIT_TO_READY: "measure:app_init_to_ready",
  TIME_TO_FIRST_MESSAGE: "measure:time_to_first_message",
  STREAMING_START_LATENCY: (id: string) => `measure:streaming_start_latency:${id}`,
  STREAMING_TOTAL_DURATION: (id: string) => `measure:streaming_total_duration:${id}`,
  INPUT_TO_DISPLAY_LATENCY: (id: string) => `measure:input_to_display_latency:${id}`,
} as const;

// ── Reporter ──────────────────────────────────────────────────────────────────

export interface PerfMeasurement {
  name: string;
  durationMs: number;
  startTime: number;
}

type Reporter = (measurement: PerfMeasurement) => void;

let reporter: Reporter = (m) => {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[perf] ${m.name}: ${Math.round(m.durationMs)}ms`);
  }
};

/** Override the default reporter (console.debug) with your own sink. */
export function setReporter(fn: Reporter): void {
  reporter = fn;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

function canUsePerf(): boolean {
  return typeof performance !== "undefined" && typeof performance.mark === "function";
}

export function mark(name: string): void {
  if (!canUsePerf()) return;
  try {
    performance.mark(name);
  } catch {
    // Silently ignore — not critical
  }
}

export function measure(measureName: string, startMark: string, endMark?: string): number | null {
  if (!canUsePerf()) return null;
  try {
    const entry = endMark
      ? performance.measure(measureName, startMark, endMark)
      : performance.measure(measureName, startMark);
    reporter({ name: measureName, durationMs: entry.duration, startTime: entry.startTime });
    return entry.duration;
  } catch {
    return null;
  }
}

export function clearMark(name: string): void {
  if (!canUsePerf()) return;
  try {
    performance.clearMarks(name);
  } catch {/* ignore */}
}

// ── High-level tracking helpers ───────────────────────────────────────────────

/**
 * Mark the moment the app shell finishes bootstrapping.
 * Call from the root layout once hydration is complete.
 */
export function markAppReady(): void {
  mark(Marks.APP_READY);
  measure(Measures.APP_INIT_TO_READY, Marks.APP_INIT, Marks.APP_READY);
}

/**
 * Mark the first message rendered in a conversation.
 * Call from the message list component when it mounts with the first message.
 */
export function markFirstMessageRender(): void {
  mark(Marks.FIRST_MESSAGE_RENDER);
  measure(Measures.TIME_TO_FIRST_MESSAGE, Marks.CONVERSATION_START, Marks.FIRST_MESSAGE_RENDER);
}

/**
 * Track streaming latency for a single response.
 * Returns a handle with `firstToken()` and `complete()` callbacks.
 */
export function trackStreaming(streamId: string): {
  firstToken(): void;
  complete(): void;
} {
  mark(Marks.STREAM_REQUEST_START(streamId));

  return {
    firstToken() {
      mark(Marks.STREAM_FIRST_TOKEN(streamId));
      measure(
        Measures.STREAMING_START_LATENCY(streamId),
        Marks.STREAM_REQUEST_START(streamId),
        Marks.STREAM_FIRST_TOKEN(streamId),
      );
    },
    complete() {
      mark(Marks.STREAM_COMPLETE(streamId));
      measure(
        Measures.STREAMING_TOTAL_DURATION(streamId),
        Marks.STREAM_REQUEST_START(streamId),
        Marks.STREAM_COMPLETE(streamId),
      );
      // Clean up marks to avoid memory leaks on long sessions
      clearMark(Marks.STREAM_REQUEST_START(streamId));
      clearMark(Marks.STREAM_FIRST_TOKEN(streamId));
      clearMark(Marks.STREAM_COMPLETE(streamId));
    },
  };
}

/**
 * Track input-to-display latency for a user message.
 * Call `trackInput(id)` when the user submits, and the returned function when
 * the response appears in the DOM.
 */
export function trackInput(inputId: string): () => void {
  mark(Marks.INPUT_SUBMIT(inputId));

  return () => {
    mark(Marks.RESPONSE_DISPLAYED(inputId));
    measure(
      Measures.INPUT_TO_DISPLAY_LATENCY(inputId),
      Marks.INPUT_SUBMIT(inputId),
      Marks.RESPONSE_DISPLAYED(inputId),
    );
    clearMark(Marks.INPUT_SUBMIT(inputId));
    clearMark(Marks.RESPONSE_DISPLAYED(inputId));
  };
}

// ── Network request tracker ───────────────────────────────────────────────────

export interface RequestTiming {
  url: string;
  method: string;
  durationMs: number;
  status: number;
  ok: boolean;
}

type NetworkReporter = (timing: RequestTiming) => void;

let networkReporter: NetworkReporter | null = null;

export function setNetworkReporter(fn: NetworkReporter): void {
  networkReporter = fn;
}

/**
 * Wrap `fetch` to automatically record request timings.
 * Call once at app init — patches the global fetch.
 */
export function patchFetchForMonitoring(): void {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const start = Date.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    try {
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - start;

      if (networkReporter) {
        networkReporter({ url, method, durationMs, status: response.status, ok: response.ok });
      }

      if (!response.ok && process.env.NODE_ENV !== "production") {
        console.warn(`[network] ${method} ${url} → ${response.status} (${durationMs}ms)`);
      }

      return response;
    } catch (err) {
      const durationMs = Date.now() - start;
      if (networkReporter) {
        networkReporter({ url, method, durationMs, status: 0, ok: false });
      }
      throw err;
    }
  };
}

// ── Module init ───────────────────────────────────────────────────────────────

// Place the app:init mark as early as possible
mark(Marks.APP_INIT);
