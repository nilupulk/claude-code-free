/**
 * Web Vitals reporting.
 *
 * Collects Core Web Vitals (LCP, FID/INP, CLS, TTFB) and reports them to
 * the configured analytics endpoint.  Call `initWebVitals()` once from your
 * Next.js app layout or a client component.
 *
 * Environment variables (NEXT_PUBLIC_ prefix required for client-side access):
 *   NEXT_PUBLIC_ANALYTICS_URL — endpoint to POST vitals to (optional)
 *   NEXT_PUBLIC_APP_VERSION   — release tag sent with each report
 */

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VitalReport {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  release?: string;
}

// ── Reporter ──────────────────────────────────────────────────────────────────

const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_URL;
const release = process.env.NEXT_PUBLIC_APP_VERSION;

function toReport(metric: Metric): VitalReport {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    release,
  };
}

function send(report: VitalReport): void {
  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    const icon = report.rating === "good" ? "✅" : report.rating === "needs-improvement" ? "⚠️" : "❌";
    console.debug(`[vitals] ${icon} ${report.name}: ${Math.round(report.value)}ms (${report.rating})`);
  }

  // Push to dataLayer for GTM/GA4 if present
  if (typeof window !== "undefined" && "dataLayer" in window) {
    (window as Window & { dataLayer: unknown[] }).dataLayer.push({
      event: "web_vitals",
      web_vitals_metric_name: report.name,
      web_vitals_value: Math.round(report.value),
      web_vitals_rating: report.rating,
    });
  }

  // POST to custom analytics endpoint
  if (endpoint) {
    const body = JSON.stringify(report);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {/* best-effort */});
    }
  }
}

/**
 * Initialise Web Vitals collection.
 * Call this once inside a `"use client"` component that mounts at app root.
 */
export function initWebVitals(): void {
  if (typeof window === "undefined") return;

  const reporter = (metric: Metric) => send(toReport(metric));

  onCLS(reporter);
  onFCP(reporter);
  onFID(reporter);
  onINP(reporter);
  onLCP(reporter);
  onTTFB(reporter);
}
