// ─── Analytics Express Router ─────────────────────────────────────────────────
//
// Routes:
//   POST /analytics/events          — ingest a batch of events
//   GET  /analytics/summary?days=N  — aggregated summary (admin only)
//   GET  /analytics/export?days=N   — CSV export (admin only)
//   DELETE /analytics/events?sessionId — delete events for a session

import { Router } from "express";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../web/auth/adapter.js";
import { analyticsStorage } from "./storage.js";
import { processBatch } from "./processor.js";
import { aggregate } from "./aggregator.js";

const TELEMETRY_ENABLED = process.env.TELEMETRY_ENABLED !== "false";

function requireAdmin(req: Request, res: Response, next: () => void): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function createAnalyticsRouter(): Router {
  const router = Router();

  // ── Ingest ─────────────────────────────────────────────────────────────────

  /**
   * POST /analytics/events
   * Accepts a batch of events from the client-side analytics library.
   * No authentication required — events are always anonymous.
   */
  router.post("/events", (req, res) => {
    if (!TELEMETRY_ENABLED) {
      res.json({ ok: true, received: 0, note: "telemetry disabled" });
      return;
    }

    const rawEvents: unknown[] = Array.isArray(req.body?.events) ? req.body.events : [];
    if (rawEvents.length === 0) {
      res.status(400).json({ error: "events array is required" });
      return;
    }

    if (rawEvents.length > 100) {
      res.status(400).json({ error: "batch too large (max 100)" });
      return;
    }

    const { valid, rejected } = processBatch(rawEvents);
    analyticsStorage.append(valid);

    res.json({ ok: true, received: valid.length, rejected });
  });

  // ── Summary ────────────────────────────────────────────────────────────────

  /**
   * GET /analytics/summary?days=30
   * Returns aggregated analytics for admin dashboards.
   */
  router.get("/summary", requireAdmin, async (req, res) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10), 1), 365);

    try {
      const events = await analyticsStorage.readRecent(days);
      const summary = aggregate(events, days);
      res.json(summary);
    } catch (err) {
      console.error("[analytics] summary error:", err);
      res.status(500).json({ error: "Failed to compute summary" });
    }
  });

  // ── CSV Export ─────────────────────────────────────────────────────────────

  /**
   * GET /analytics/export?days=30
   * Downloads raw events as CSV.
   */
  router.get("/export", requireAdmin, async (req, res) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10), 1), 365);

    try {
      const events = await analyticsStorage.readRecent(days);
      const header = "id,name,timestamp,sessionId,receivedAt,properties\n";
      const rows = events.map((e) =>
        [
          e.id,
          e.name,
          e.timestamp,
          e.sessionId,
          e.receivedAt,
          JSON.stringify(e.properties).replace(/"/g, '""'),
        ]
          .map((v) => `"${v}"`)
          .join(","),
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="analytics-${days}d.csv"`);
      res.send(header + rows.join("\n"));
    } catch (err) {
      console.error("[analytics] export error:", err);
      res.status(500).json({ error: "Failed to export events" });
    }
  });

  // ── Data Deletion ──────────────────────────────────────────────────────────

  /**
   * DELETE /analytics/events?sessionId=<id>
   * Removes all stored events for a session (GDPR-style deletion).
   * Users identify themselves by their in-memory session ID — no auth
   * required since session IDs are ephemeral and anonymous.
   */
  router.delete("/events", async (req, res) => {
    const sessionId = String(req.query.sessionId ?? "").trim();
    if (!sessionId || sessionId.length > 64) {
      res.status(400).json({ error: "valid sessionId is required" });
      return;
    }

    try {
      const deleted = await analyticsStorage.deleteBySession(sessionId);
      res.json({ ok: true, deleted });
    } catch (err) {
      console.error("[analytics] deletion error:", err);
      res.status(500).json({ error: "Failed to delete events" });
    }
  });

  // ── Prune (cron-style, triggered by a simple GET from a scheduled task) ────

  /**
   * POST /analytics/prune
   * Removes log files older than the retention window. Admin only.
   */
  router.post("/prune", requireAdmin, (_req, res) => {
    try {
      const pruned = analyticsStorage.pruneOldFiles();
      res.json({ ok: true, pruned });
    } catch (err) {
      console.error("[analytics] prune error:", err);
      res.status(500).json({ error: "Failed to prune old files" });
    }
  });

  return router;
}
