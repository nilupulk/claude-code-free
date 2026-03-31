/**
 * Conversation routes — CRUD + SSE message streaming.
 *
 * POST /api/conversations/:id/messages  → text/event-stream
 * POST /api/conversations/:id/approve   → resolve pending tool approvals
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rateLimitRequests, rateLimitMessages } from "../middleware/rate-limit.js";
import { ApiError } from "../middleware/error-handler.js";
import { SSEStream } from "../streaming/sse.js";
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  deleteLastAssistantMessage,
  exportConversation,
} from "../services/conversation-service.js";
import { streamMessage, resolveToolApproval } from "../services/claude-service.js";
import { FileService } from "../services/file-service.js";
import { ExecService } from "../services/exec-service.js";
import type { ToolExecutor } from "../services/claude-service.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const CreateConvSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string().optional(),
});

const UpdateConvSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string().optional(),
  isPinned: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const SendMessageSchema = z.object({
  content: z.string().min(1).max(200_000),
  files: z
    .array(z.object({ name: z.string(), content: z.string(), mediaType: z.string().optional() }))
    .optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().min(1).max(32_768).optional(),
  systemPrompt: z.string().optional(),
  autoApprove: z.record(z.boolean()).optional(),
});

const ApprovalSchema = z.object({
  tool_use_id: z.string(),
  approved: z.boolean(),
});

// ── Tool executor ─────────────────────────────────────────────────────────────

const _fileService = new FileService();
const _execService = new ExecService();

function buildExecutor(): ToolExecutor {
  return {
    read: async (path, limit, offset) => {
      const { content } = _fileService.read(path, limit, offset);
      return content;
    },
    write: async (path, content) => { _fileService.write(path, content); },
    glob: async (pattern, dir) => _fileService.glob(pattern, dir),
    grep: async (pattern, path, glob) => _fileService.grep(pattern, path, glob),
    bash: async (command, timeout) => {
      const { id } = _execService.start({ command, timeoutMs: timeout });
      return await new Promise<string>((resolve) => {
        const lines: string[] = [];
        _execService.subscribe(id, (l) => lines.push(l), () => resolve(lines.join("\n")));
      });
    },
    ls: async (path) => {
      const entries = _fileService.list(path);
      return entries.map((e) => `${e.type === "directory" ? "d" : "-"} ${e.name}`).join("\n");
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deserializeMessages(messages: Array<{ contentJson: string; [key: string]: unknown }>) {
  return messages.map((m) => {
    let content: unknown;
    try { content = JSON.parse(m.contentJson); } catch { content = m.contentJson; }
    const { contentJson: _, ...rest } = m;
    void _;
    return { ...rest, content };
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createConversationsRouter(): express.Router {
  const router = express.Router();
  const auth = requireAuth as express.RequestHandler;
  const limit = rateLimitRequests as express.RequestHandler;
  const limitMsg = rateLimitMessages as express.RequestHandler;

  // GET /api/conversations
  router.get("/", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const pageLimit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
      const offset = parseInt(String(req.query.offset ?? "0"), 10);
      const result = listConversations(user.id, { limit: pageLimit, offset });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/conversations
  router.post("/", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const body = CreateConvSchema.parse(req.body);
      const conv = createConversation(user.id, body);
      res.status(201).json(conv);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/conversations/:id
  router.get("/:id", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const conv = getConversation(req.params.id, user.id);
      res.json({ ...conv, messages: deserializeMessages(conv.messages) });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/conversations/:id
  router.put("/:id", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const updates = UpdateConvSchema.parse(req.body);
      const conv = updateConversation(req.params.id, user.id, updates);
      res.json(conv);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/conversations/:id
  router.delete("/:id", auth, limit, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      deleteConversation(req.params.id, user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/conversations/:id/messages — SSE streaming
  router.post(
    "/:id/messages",
    auth,
    limitMsg,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const body = SendMessageSchema.parse(req.body);
        const conv = getConversation(req.params.id, user.id);

        const sseStream = new SSEStream(res);
        req.on("close", () => sseStream.close());

        await streamMessage({
          conversationId: req.params.id,
          userId: user.id,
          userMessage: body.content,
          files: body.files,
          model: body.model ?? conv.model,
          maxTokens: body.maxTokens ?? 8096,
          systemPrompt: body.systemPrompt,
          autoApprove: body.autoApprove ?? {},
          apiKey: user.apiKey ?? process.env.ANTHROPIC_API_KEY,
          executor: buildExecutor(),
          stream: sseStream,
        });
      } catch (err) {
        if (!res.headersSent) next(err);
      }
    },
  );

  // POST /api/conversations/:id/stop
  router.post("/:id/stop", auth, (req: Request, res: Response, next: NextFunction) => {
    try {
      void req.params.id;
      res.json({ status: "stop_requested" });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/conversations/:id/retry
  router.post(
    "/:id/retry",
    auth,
    limitMsg,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const body = SendMessageSchema.partial()
          .extend({ content: z.string().optional() })
          .parse(req.body);

        deleteLastAssistantMessage(req.params.id, user.id);
        const conv = getConversation(req.params.id, user.id);

        const lastUser = [...conv.messages].reverse().find((m) => m.role === "user");
        if (!lastUser) throw ApiError.badRequest("No user message to retry");

        let content: string;
        try {
          const parsed = JSON.parse(lastUser.contentJson);
          content = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
        } catch {
          content = lastUser.contentJson;
        }

        const sseStream = new SSEStream(res);
        req.on("close", () => sseStream.close());

        await streamMessage({
          conversationId: req.params.id,
          userId: user.id,
          userMessage: content,
          model: body.model ?? conv.model,
          maxTokens: body.maxTokens ?? 8096,
          systemPrompt: body.systemPrompt,
          autoApprove: body.autoApprove ?? {},
          apiKey: user.apiKey ?? process.env.ANTHROPIC_API_KEY,
          executor: buildExecutor(),
          stream: sseStream,
        });
      } catch (err) {
        if (!res.headersSent) next(err);
      }
    },
  );

  // POST /api/conversations/:id/approve — resolve pending tool approval
  router.post("/:id/approve", auth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ApprovalSchema.parse(req.body);
      const ok = resolveToolApproval(body.tool_use_id, body.approved);
      if (!ok) throw ApiError.notFound("Pending tool approval");
      res.json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/conversations/:id/export
  router.get("/:id/export", auth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const format = (req.query.format as string | undefined) ?? "markdown";
      if (!["json", "markdown", "plaintext"].includes(format)) {
        throw ApiError.badRequest("format must be json, markdown, or plaintext");
      }
      const content = exportConversation(
        req.params.id,
        user.id,
        format as "json" | "markdown" | "plaintext",
      );
      const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
      const mimeTypes: Record<string, string> = {
        json: "application/json",
        markdown: "text/markdown",
        plaintext: "text/plain",
      };
      res.setHeader("Content-Type", mimeTypes[format] ?? "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="conversation-${req.params.id}.${ext}"`);
      res.send(content);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
