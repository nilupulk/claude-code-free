/**
 * Token usage and cost tracking.
 *
 * Records per-user, per-model token consumption in-memory (survives process
 * restarts if you persist to a store via the optional adapter).  Exposes
 * aggregated totals suitable for an admin dashboard and CSV export.
 *
 * Model prices are stored as USD per 1 M tokens and should be updated when
 * Anthropic adjusts pricing.  Set COST_ALERT_THRESHOLD_USD to trigger alerts.
 *
 * Usage:
 *   import { costTracker } from "./observability/cost-tracker.js";
 *   costTracker.record({ userId, model, inputTokens: 500, outputTokens: 200 });
 */

import { tokensUsedTotal } from "./metrics.js";
import { logger } from "./logger.js";

// ── Model pricing (USD per 1 M tokens) ───────────────────────────────────────

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 0.8, outputPer1M: 4.0 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4.0 },
  "claude-3-opus-20240229": { inputPer1M: 15.0, outputPer1M: 75.0 },
  // Fallback for unknown models
  _default: { inputPer1M: 3.0, outputPer1M: 15.0 },
};

// ── Data types ────────────────────────────────────────────────────────────────

export interface UsageRecord {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Unix timestamp ms */
  timestamp: number;
}

interface DailyBucket {
  date: string; // YYYY-MM-DD
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// ── Cost computation ──────────────────────────────────────────────────────────

function getPricing(model: string): ModelPricing {
  // Match by prefix so "claude-sonnet-4-6-20250219" maps correctly
  for (const [key, price] of Object.entries(DEFAULT_PRICING)) {
    if (key === "_default") continue;
    if (model.startsWith(key)) return price;
  }
  return DEFAULT_PRICING["_default"]!;
}

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricing(model);
  return (inputTokens / 1_000_000) * pricing.inputPer1M +
         (outputTokens / 1_000_000) * pricing.outputPer1M;
}

// ── CostTracker class ─────────────────────────────────────────────────────────

export class CostTracker {
  /** Daily usage buckets keyed by "YYYY-MM-DD:userId:model" */
  private readonly buckets = new Map<string, DailyBucket>();

  /** Optional alert threshold in USD per user per day */
  private readonly alertThresholdUsd: number;

  /** Triggered when a user exceeds their daily cost threshold */
  onThresholdExceeded?: (userId: string, totalUsd: number) => void;

  constructor(alertThresholdUsd?: number) {
    this.alertThresholdUsd = alertThresholdUsd ??
      parseFloat(process.env.COST_ALERT_THRESHOLD_USD ?? "0");
  }

  /** Record token usage for a completed API call. */
  record(entry: Omit<UsageRecord, "timestamp">): void {
    const { userId, model, inputTokens, outputTokens } = entry;
    const date = new Date().toISOString().slice(0, 10);
    const key = `${date}:${userId}:${model}`;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { date, userId, model, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
      this.buckets.set(key, bucket);
    }

    bucket.inputTokens += inputTokens;
    bucket.outputTokens += outputTokens;
    bucket.estimatedCostUsd = computeCost(model, bucket.inputTokens, bucket.outputTokens);

    // Update Prometheus counters
    tokensUsedTotal.inc({ type: "input", model }, inputTokens);
    tokensUsedTotal.inc({ type: "output", model }, outputTokens);

    logger.debug(
      { userId, model, inputTokens, outputTokens, costUsd: bucket.estimatedCostUsd },
      "Token usage recorded",
    );

    // Check alert threshold
    if (this.alertThresholdUsd > 0) {
      const userDailyTotal = this.getUserDailyCost(userId, date);
      if (userDailyTotal >= this.alertThresholdUsd) {
        logger.warn(
          { userId, totalUsd: userDailyTotal, thresholdUsd: this.alertThresholdUsd },
          "Daily cost threshold exceeded",
        );
        this.onThresholdExceeded?.(userId, userDailyTotal);
      }
    }
  }

  /** Total estimated cost for a user on a given day (YYYY-MM-DD). */
  getUserDailyCost(userId: string, date?: string): number {
    const d = date ?? new Date().toISOString().slice(0, 10);
    let total = 0;
    for (const bucket of this.buckets.values()) {
      if (bucket.userId === userId && bucket.date === d) {
        total += bucket.estimatedCostUsd;
      }
    }
    return total;
  }

  /** Organisation-wide cost breakdown, optionally filtered by date range. */
  getOrgBreakdown(fromDate?: string, toDate?: string): DailyBucket[] {
    const results: DailyBucket[] = [];
    for (const bucket of this.buckets.values()) {
      if (fromDate && bucket.date < fromDate) continue;
      if (toDate && bucket.date > toDate) continue;
      results.push({ ...bucket });
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** All-time totals per user. */
  getUserTotals(): Array<{ userId: string; totalInputTokens: number; totalOutputTokens: number; totalCostUsd: number }> {
    const map = new Map<string, { totalInputTokens: number; totalOutputTokens: number; totalCostUsd: number }>();
    for (const bucket of this.buckets.values()) {
      const existing = map.get(bucket.userId) ?? { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0 };
      existing.totalInputTokens += bucket.inputTokens;
      existing.totalOutputTokens += bucket.outputTokens;
      existing.totalCostUsd += bucket.estimatedCostUsd;
      map.set(bucket.userId, existing);
    }
    return Array.from(map.entries()).map(([userId, totals]) => ({ userId, ...totals }));
  }

  /**
   * Generate a CSV string of daily usage records for billing/export.
   * Columns: date, userId, model, inputTokens, outputTokens, estimatedCostUsd
   */
  exportCsv(fromDate?: string, toDate?: string): string {
    const rows = this.getOrgBreakdown(fromDate, toDate);
    const header = "date,userId,model,inputTokens,outputTokens,estimatedCostUsd";
    const lines = rows.map(
      (r) => `${r.date},${r.userId},${r.model},${r.inputTokens},${r.outputTokens},${r.estimatedCostUsd.toFixed(6)}`,
    );
    return [header, ...lines].join("\n");
  }

  /** Prune buckets older than `days` days to cap memory usage. */
  prune(days = 90): void {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.date < cutoff) this.buckets.delete(key);
    }
  }
}

/** Singleton instance — import this from other modules. */
export const costTracker = new CostTracker();

// Auto-prune old records daily
setInterval(() => costTracker.prune(), 24 * 60 * 60 * 1000).unref();
