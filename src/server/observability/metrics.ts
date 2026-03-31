/**
 * Prometheus metrics for the PTY / API server.
 *
 * Exposes a /metrics endpoint that Prometheus (or any compatible scraper) can poll.
 * prom-client collects default Node.js runtime metrics automatically.
 *
 * Usage:
 *   import { metricsMiddleware, metricsHandler } from "./observability/metrics.js";
 *   app.use(metricsMiddleware);
 *   app.get("/metrics", metricsHandler);
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";
import type { Request, Response, NextFunction } from "express";

// ── Registry ──────────────────────────────────────────────────────────────────

export const registry = new Registry();
registry.setDefaultLabels({ app: "claude-code-server" });

// Collect default Node.js metrics (heap, GC, event loop, etc.)
collectDefaultMetrics({ register: registry });

// ── HTTP metrics ──────────────────────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

export const httpRequestSizeBytes = new Histogram({
  name: "http_request_size_bytes",
  help: "HTTP request body size in bytes",
  labelNames: ["method", "route"] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000],
  registers: [registry],
});

export const httpResponseSizeBytes = new Histogram({
  name: "http_response_size_bytes",
  help: "HTTP response body size in bytes",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000],
  registers: [registry],
});

// ── Business metrics ──────────────────────────────────────────────────────────

export const conversationsCreatedTotal = new Counter({
  name: "conversations_created_total",
  help: "Total number of conversations (PTY sessions) created",
  registers: [registry],
});

export const messagesSentTotal = new Counter({
  name: "messages_sent_total",
  help: "Total messages sent",
  labelNames: ["role"] as const, // user | assistant
  registers: [registry],
});

export const tokensUsedTotal = new Counter({
  name: "tokens_used_total",
  help: "Total tokens consumed",
  labelNames: ["type", "model"] as const, // type: input|output
  registers: [registry],
});

export const toolExecutionsTotal = new Counter({
  name: "tool_executions_total",
  help: "Total tool invocations",
  labelNames: ["tool", "status"] as const, // status: success|error
  registers: [registry],
});

export const streamingDurationSeconds = new Histogram({
  name: "streaming_duration_seconds",
  help: "End-to-end duration of a streaming response",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
});

export const activeSessions = new Gauge({
  name: "active_sessions",
  help: "Number of currently active PTY sessions",
  registers: [registry],
});

export const activeStreams = new Gauge({
  name: "active_streams",
  help: "Number of in-flight streaming responses",
  registers: [registry],
});

// ── System / infra metrics ────────────────────────────────────────────────────

export const nodejsHeapUsedBytes = new Gauge({
  name: "nodejs_heap_used_bytes",
  help: "Node.js heap used in bytes",
  registers: [registry],
  collect() {
    this.set(process.memoryUsage().heapUsed);
  },
});

export const eventLoopLagSeconds = new Histogram({
  name: "nodejs_eventloop_lag_seconds",
  help: "Event-loop lag sampled every 500 ms",
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

export const dbPoolActive = new Gauge({
  name: "db_pool_active",
  help: "Active database pool connections",
  registers: [registry],
});

export const dbQueryDurationSeconds = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// ── Event-loop lag sampler ────────────────────────────────────────────────────

let lagSampler: ReturnType<typeof setInterval> | null = null;

export function startEventLoopSampler(intervalMs = 500): void {
  if (lagSampler) return;
  lagSampler = setInterval(() => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e9;
      eventLoopLagSeconds.observe(lag);
    });
  }, intervalMs).unref();
}

export function stopEventLoopSampler(): void {
  if (lagSampler) {
    clearInterval(lagSampler);
    lagSampler = null;
  }
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Record HTTP duration + count for every request.
 * Mount BEFORE routes so the timer starts early.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Record request size
  const reqSize = parseInt(req.headers["content-length"] ?? "0", 10);
  if (reqSize > 0) {
    httpRequestSizeBytes.observe({ method: req.method, route: req.path }, reqSize);
  }

  res.on("finish", () => {
    const route = (req.route?.path as string | undefined) ?? req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    const durationSecs = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSecs);
    httpRequestsTotal.inc(labels);

    const resSize = parseInt(res.getHeader("content-length") as string ?? "0", 10);
    if (resSize > 0) {
      httpResponseSizeBytes.observe(labels, resSize);
    }
  });

  next();
}

/**
 * Prometheus scrape endpoint — returns all metrics in text/plain format.
 * Register as: app.get("/metrics", metricsHandler)
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const output = await registry.metrics();
    res.set("Content-Type", registry.contentType);
    res.end(output);
  } catch (err) {
    res.status(500).end(String(err));
  }
}
