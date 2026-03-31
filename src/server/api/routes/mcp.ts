/**
 * MCP server configuration routes.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";
import { ApiError } from "../middleware/error-handler.js";
import { db, flush } from "../db/connection.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const McpServerSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  enabled: z.boolean().default(true),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

function getUserMcpServers(userId: string): McpServerConfig[] {
  const stored = db().settings[userId];
  if (!stored) return [];
  try {
    const settings = JSON.parse(stored.settingsJson) as { mcpServers?: McpServerConfig[] };
    return settings.mcpServers ?? [];
  } catch {
    return [];
  }
}

function saveUserMcpServers(userId: string, servers: McpServerConfig[]): void {
  const store = db();
  const existing = store.settings[userId];
  let current: Record<string, unknown> = {};
  if (existing) {
    try { current = JSON.parse(existing.settingsJson) as Record<string, unknown>; } catch { /* ignore */ }
  }
  current.mcpServers = servers;
  store.settings[userId] = {
    userId,
    settingsJson: JSON.stringify(current),
    updatedAt: Date.now(),
  };
  flush();
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createMcpRouter(): express.Router {
  const router = express.Router();
  const mw = [requireAuth as express.RequestHandler, rateLimitRequests as express.RequestHandler];

  // GET /api/mcp/servers
  router.get("/servers", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      res.json({ servers: getUserMcpServers(user.id) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/mcp/servers
  router.post("/servers", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const body = McpServerSchema.parse(req.body);
      const servers = getUserMcpServers(user.id);
      const newServer: McpServerConfig = { id: crypto.randomUUID(), ...body };
      servers.push(newServer);
      saveUserMcpServers(user.id, servers);
      res.status(201).json(newServer);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/mcp/servers/:id
  router.put("/servers/:id", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const updates = McpServerSchema.partial().parse(req.body);
      const servers = getUserMcpServers(user.id);
      const idx = servers.findIndex((s) => s.id === req.params.id);
      if (idx === -1) throw ApiError.notFound("MCP server");
      servers[idx] = { ...servers[idx], ...updates };
      saveUserMcpServers(user.id, servers);
      res.json(servers[idx]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/mcp/servers/:id
  router.delete("/servers/:id", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const servers = getUserMcpServers(user.id);
      const filtered = servers.filter((s) => s.id !== req.params.id);
      if (filtered.length === servers.length) throw ApiError.notFound("MCP server");
      saveUserMcpServers(user.id, filtered);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/mcp/servers/:id/test
  router.post("/servers/:id/test", ...mw, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const servers = getUserMcpServers(user.id);
      const server = servers.find((s) => s.id === req.params.id);
      if (!server) throw ApiError.notFound("MCP server");

      const { execSync } = await import("child_process");
      try {
        execSync(`${server.command} ${server.args.join(" ")} --help 2>&1`, {
          timeout: 5000,
          env: { ...process.env, ...server.env },
        });
        res.json({ status: "reachable" });
      } catch {
        res.json({ status: "unreachable", message: "Command failed or timed out" });
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
