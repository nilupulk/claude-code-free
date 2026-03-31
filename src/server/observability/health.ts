/**
 * Health-check HTTP handlers.
 *
 * Three endpoints following the Kubernetes probe convention:
 *
 *   GET /health          — liveness probe  (is the process alive?)
 *   GET /health/ready    — readiness probe (can it serve traffic?)
 *   GET /health/startup  — startup probe   (did it finish initialising?)
 *
 * Register in pty-server.ts before other routes:
 *
 *   import { livenessHandler, readinessHandler, startupHandler } from "./observability/health.js";
 *   app.get("/health", livenessHandler);
 *   app.get("/health/ready", readinessHandler);
 *   app.get("/health/startup", startupHandler);
 */

import type { Request, Response } from "express";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "degraded" | "error";

interface CheckResult {
  status: CheckStatus;
  latency_ms?: number;
  message?: string;
}

interface ReadinessBody {
  status: CheckStatus;
  checks: Record<string, CheckResult>;
}

// ── Check registry ────────────────────────────────────────────────────────────

type HealthCheck = () => Promise<CheckResult>;

const checks = new Map<string, HealthCheck>();

/**
 * Register a named health-check function.
 * The check should resolve quickly (< 5 s) and never throw — return status "error" instead.
 *
 * @example
 * registerCheck("database", async () => {
 *   const start = Date.now();
 *   await db.query("SELECT 1");
 *   return { status: "ok", latency_ms: Date.now() - start };
 * });
 */
export function registerCheck(name: string, fn: HealthCheck): void {
  checks.set(name, fn);
}

// ── Startup flag ──────────────────────────────────────────────────────────────

let startupComplete = false;
let migrationsApplied = false;

export function markStartupComplete(migrations = true): void {
  startupComplete = true;
  migrationsApplied = migrations;
}

// ── Process start time ────────────────────────────────────────────────────────

const startedAt = Date.now();

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Minimal liveness check — if this returns 200 the process is alive.
 */
export function livenessHandler(_req: Request, res: Response): void {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  });
}

/**
 * GET /health/ready
 * Runs all registered checks and returns 200 only when all pass.
 * Returns 503 if any check reports "error".
 */
export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const results: Record<string, CheckResult> = {};
  let overall: CheckStatus = "ok";

  await Promise.allSettled(
    Array.from(checks.entries()).map(async ([name, fn]) => {
      try {
        const result = await withTimeout(fn(), 5_000);
        results[name] = result;
        if (result.status === "error") overall = "error";
        else if (result.status === "degraded" && overall !== "error") overall = "degraded";
      } catch (err) {
        results[name] = { status: "error", message: String(err) };
        overall = "error";
      }
    }),
  );

  const body: ReadinessBody = { status: overall, checks: results };
  res.status(overall === "error" ? 503 : 200).json(body);
}

/**
 * GET /health/startup
 * Returns 200 once `markStartupComplete()` has been called (e.g. after migrations).
 * K8s will not send live traffic until this passes.
 */
export function startupHandler(_req: Request, res: Response): void {
  if (!startupComplete) {
    res.status(503).json({ status: "starting", migrations_applied: false });
    return;
  }
  res.json({ status: "ok", migrations_applied: migrationsApplied });
}

// ── Built-in checks ───────────────────────────────────────────────────────────

/** Register an Anthropic API reachability check. */
export function registerAnthropicCheck(): void {
  registerCheck("anthropic_api", async () => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      const resp = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: { "anthropic-version": "2023-06-01" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // 401 is fine — the API is reachable, we just didn't send a key.
      if (resp.status === 401 || resp.ok) {
        return { status: "ok", latency_ms: Date.now() - start };
      }
      return { status: "degraded", latency_ms: Date.now() - start, message: `HTTP ${resp.status}` };
    } catch (err) {
      return { status: "error", latency_ms: Date.now() - start, message: String(err) };
    }
  });
}

/** Register a Redis reachability check. */
export function registerRedisCheck(pingFn: () => Promise<void>): void {
  registerCheck("redis", async () => {
    const start = Date.now();
    try {
      await withTimeout(pingFn(), 2_000);
      return { status: "ok", latency_ms: Date.now() - start };
    } catch (err) {
      return { status: "error", latency_ms: Date.now() - start, message: String(err) };
    }
  });
}

/** Register a generic database check. */
export function registerDatabaseCheck(queryFn: () => Promise<void>): void {
  registerCheck("database", async () => {
    const start = Date.now();
    try {
      await withTimeout(queryFn(), 3_000);
      return { status: "ok", latency_ms: Date.now() - start };
    } catch (err) {
      return { status: "error", latency_ms: Date.now() - start, message: String(err) };
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
