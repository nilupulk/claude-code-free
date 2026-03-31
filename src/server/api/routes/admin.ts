import express, { type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { db } from "../db/connection.js";

export function createAdminApiRouter(): express.Router {
  const router = express.Router();

  // All admin routes require auth + admin role
  router.use(requireAuth as express.RequestHandler, requireAdmin as express.RequestHandler);

  // GET /api/admin/sessions — active exec processes
  router.get("/sessions", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const store = db();
      const active = Object.values(store.processes).filter(
        (p) => p.status === "running",
      );
      res.json({ sessions: active, total: active.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/stats — system statistics
  router.get("/stats", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const store = db();
      const conversations = Object.values(store.conversations);
      const messages = Object.values(store.messages);

      const userIds = new Set(conversations.map((c) => c.userId));

      res.json({
        users: userIds.size,
        conversations: conversations.length,
        messages: messages.length,
        toolUses: Object.keys(store.toolUses).length,
        activeProcesses: Object.values(store.processes).filter(
          (p) => p.status === "running",
        ).length,
        tokenUsage: messages
          .filter((m) => m.role === "assistant")
          .reduce(
            (acc, m) => ({
              input: acc.input + (m.inputTokens ?? 0),
              output: acc.output + (m.outputTokens ?? 0),
            }),
            { input: 0, output: 0 },
          ),
        uptime: process.uptime(),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/users — list users derived from conversation data
  router.get("/users", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const store = db();
      const userMap = new Map<string, { id: string; conversations: number; messages: number }>();

      for (const conv of Object.values(store.conversations)) {
        if (!userMap.has(conv.userId)) {
          userMap.set(conv.userId, { id: conv.userId, conversations: 0, messages: 0 });
        }
        userMap.get(conv.userId)!.conversations++;
      }

      for (const msg of Object.values(store.messages)) {
        const conv = store.conversations[msg.conversationId];
        if (!conv) continue;
        const user = userMap.get(conv.userId);
        if (user) user.messages++;
      }

      res.json({ users: [...userMap.values()], total: userMap.size });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
