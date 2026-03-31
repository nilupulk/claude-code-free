"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyticsSummary } from "@/../../src/server/analytics/aggregator";

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchSummary(days: number): Promise<AnalyticsSummary> {
  const res = await fetch(`/api/analytics/summary?days=${days}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function downloadCSV(days: number) {
  const res = await fetch(`/api/analytics/export?days=${days}`);
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${days}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Micro chart ──────────────────────────────────────────────────────────────

function Sparkline({ values, color = "#6366f1" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <span className="text-muted-foreground text-xs">—</span>;
  const max = Math.max(...values, 1);
  const w = 80;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSummary(days));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Anonymous usage data — no personal information collected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            aria-label="Date range"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => void downloadCSV(days)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => void load()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Sessions" value={data.totals.sessions.toLocaleString()} />
            <StatCard label="Messages" value={data.totals.messages.toLocaleString()} />
            <StatCard
              label="Avg response"
              value={
                data.totals.avg_response_ms > 0
                  ? `${(data.totals.avg_response_ms / 1000).toFixed(1)}s`
                  : "—"
              }
            />
            <StatCard
              label="Avg tokens"
              value={
                data.totals.avg_tokens_per_response > 0
                  ? data.totals.avg_tokens_per_response.toLocaleString()
                  : "—"
              }
            />
            <StatCard label="Errors" value={data.totals.errors.toLocaleString()} />
            <StatCard
              label="Error rate"
              value={`${(data.error_rate * 100).toFixed(1)}%`}
              sub={`${data.totals.events.toLocaleString()} events`}
            />
          </div>

          {/* Daily trend */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">Daily activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Sessions</th>
                    <th className="pb-2 pr-4 font-medium">Messages</th>
                    <th className="pb-2 pr-4 font-medium">Events</th>
                    <th className="pb-2 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.slice(-14).reverse().map((d) => (
                    <tr key={d.date} className="border-t border-border/50">
                      <td className="py-1.5 pr-4 font-mono text-xs">{d.date}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{d.sessions}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{d.messages}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{d.events}</td>
                      <td className="py-1.5 tabular-nums text-destructive/80">{d.errors || "—"}</td>
                    </tr>
                  ))}
                  {data.daily.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        No data in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.daily.length >= 2 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Messages / day</span>
                <Sparkline values={data.daily.map((d) => d.messages)} color="#6366f1" />
                <span className="ml-4">Sessions / day</span>
                <Sparkline values={data.daily.map((d) => d.sessions)} color="#22d3ee" />
              </div>
            )}
          </div>

          {/* Models + Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Models */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">Most used models</h3>
              {data.models.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-2">
                  {data.models.map((m) => {
                    const pct = data.totals.messages > 0
                      ? Math.round((m.count / data.totals.messages) * 100)
                      : 0;
                    return (
                      <div key={m.model}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-mono">{m.model}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {m.count.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tools */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">Tool usage</h3>
              {data.tools.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1.5 pr-3 font-medium">Tool</th>
                      <th className="pb-1.5 pr-3 font-medium text-right">Calls</th>
                      <th className="pb-1.5 pr-3 font-medium text-right">Errors</th>
                      <th className="pb-1.5 font-medium text-right">Avg ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tools.slice(0, 10).map((t) => (
                      <tr key={t.tool_name} className="border-t border-border/50">
                        <td className="py-1 pr-3 font-mono">{t.tool_name}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{t.count}</td>
                        <td className="py-1 pr-3 text-right tabular-nums text-destructive/80">
                          {t.errors || "—"}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {t.avg_duration_ms > 0 ? t.avg_duration_ms : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
