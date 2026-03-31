import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";
import { db, flush } from "../db/connection.js";
import type { DbSettings } from "../db/schema.js";

// ── Available models ──────────────────────────────────────────────────────────

const MODELS = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200_000, maxOutput: 32_768 },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200_000, maxOutput: 16_384 },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", contextWindow: 200_000, maxOutput: 8_192 },
];

// ── Default settings ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  theme: "dark",
  fontSize: { chat: 14, code: 13 },
  sendOnEnter: true,
  showTimestamps: false,
  compactMode: false,
  model: "claude-opus-4-6",
  maxTokens: 8096,
  temperature: 1.0,
  systemPrompt: "",
  apiUrl: `http://localhost:${process.env.API_PORT ?? 3001}`,
  streamingEnabled: true,
  permissions: {
    autoApprove: { file_read: false, file_write: false, bash: false },
    restrictedDirs: [],
  },
  mcpServers: [],
  keybindings: {},
  telemetryEnabled: false,
};

const SettingsSchema = z.record(z.unknown());

export function createSettingsRouter(): express.Router {
  const router = express.Router();
  const mw = [requireAuth as express.RequestHandler, rateLimitRequests as express.RequestHandler];

  // GET /api/settings
  router.get("/", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const stored = db().settings[user.id];
      let settings = DEFAULT_SETTINGS;
      if (stored) {
        try {
          settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored.settingsJson) };
        } catch {
          // ignore corrupt settings
        }
      }
      res.json(settings);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/settings
  router.put("/", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const updates = SettingsSchema.parse(req.body);
      const existing = db().settings[user.id];
      let current = DEFAULT_SETTINGS as Record<string, unknown>;
      if (existing) {
        try { current = JSON.parse(existing.settingsJson) as Record<string, unknown>; } catch { /* ignore */ }
      }
      const merged = { ...current, ...updates };
      const dbSettings: DbSettings = {
        userId: user.id,
        settingsJson: JSON.stringify(merged),
        updatedAt: Date.now(),
      };
      db().settings[user.id] = dbSettings;
      flush();
      res.json(merged);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/settings/models
  router.get("/models", requireAuth as express.RequestHandler, (_req: Request, res: Response) => {
    res.json({ models: MODELS });
  });

  // GET /api/settings/usage
  router.get("/usage", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const store = db();

      let totalInput = 0;
      let totalOutput = 0;
      let messageCount = 0;

      for (const msg of Object.values(store.messages)) {
        const conv = store.conversations[msg.conversationId];
        if (!conv || conv.userId !== user.id) continue;
        if (msg.role !== "assistant") continue;
        totalInput += msg.inputTokens ?? 0;
        totalOutput += msg.outputTokens ?? 0;
        messageCount++;
      }

      res.json({
        inputTokens: totalInput,
        outputTokens: totalOutput,
        totalTokens: totalInput + totalOutput,
        assistantMessages: messageCount,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
