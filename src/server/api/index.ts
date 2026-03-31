/**
 * Unified backend API server.
 *
 * Serves all REST + SSE endpoints consumed by the web frontend and any other
 * client. Runs independently of the PTY server on API_PORT (default 3001).
 *
 * Usage:
 *   bun src/server/api/index.ts
 *   API_PORT=3001 AUTH_PROVIDER=none bun src/server/api/index.ts
 */

import express from "express";
import { createServer } from "http";

// Middleware
import { cors } from "./middleware/cors.js";
import { requestId } from "./middleware/request-id.js";
import { logger } from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

// Routes
import { createHealthRouter } from "./routes/health.js";
import { createConversationsRouter } from "./routes/conversations.js";
import { createFilesRouter } from "./routes/files.js";
import { createExecRouter } from "./routes/exec.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createMcpRouter } from "./routes/mcp.js";
import { createSearchRouter } from "./routes/search.js";
import { createAdminApiRouter } from "./routes/admin.js";

// Backwards-compatible chat endpoint
import { streamMessage } from "./services/claude-service.js";
import { requireAuth } from "./middleware/auth.js";
import type { AuthenticatedRequest } from "./middleware/auth.js";
import { rateLimitMessages } from "./middleware/rate-limit.js";
import { SSEStream } from "./streaming/sse.js";
import { createConversation, addMessage } from "./services/conversation-service.js";
import { FileService } from "./services/file-service.js";
import { ExecService } from "./services/exec-service.js";
import type { ToolExecutor } from "./services/claude-service.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.API_PORT ?? "3001", 10);
const HOST = process.env.API_HOST ?? "0.0.0.0";

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", 1);

// Body parsers (cast needed due to @types/express v5 type differences)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((express as any).json());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((express as any).urlencoded({ extended: false }));

// Global middleware (cast to express.RequestHandler for @types/express v5 compat)
app.use(cors as express.RequestHandler);
app.use(requestId as express.RequestHandler);
app.use(logger as express.RequestHandler);

// ── Health (no auth required) ─────────────────────────────────────────────────

app.use("/health", createHealthRouter());

// ── API routes ────────────────────────────────────────────────────────────────

app.use("/api/conversations", createConversationsRouter());
app.use("/api/files", createFilesRouter());
app.use("/api/exec", createExecRouter());
app.use("/api/settings", createSettingsRouter());
app.use("/api/mcp", createMcpRouter());
app.use("/api/search", createSearchRouter());
app.use("/api/admin", createAdminApiRouter());

// ── Backwards-compatible /api/chat endpoint ───────────────────────────────────
// The existing Next.js frontend proxies to POST /api/chat with
// { messages, model, stream } — we support this shape without conversation storage.

const _fileService = new FileService();
const _execService = new ExecService();

const legacyExecutor: ToolExecutor = {
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

app.post(
  "/api/chat",
  requireAuth as express.RequestHandler,
  rateLimitMessages as express.RequestHandler,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        messages,
        model = "claude-opus-4-6",
        stream: doStream = true,
      } = req.body as {
        messages: Array<{ role: string; content: unknown }>;
        model?: string;
        stream?: boolean;
      };

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "messages array required" } });
        return;
      }

      // Create an ephemeral conversation for this request
      const conv = createConversation(user.id, { model });

      // Seed with message history
      for (const m of messages.slice(0, -1)) {
        addMessage(conv.id, user.id, {
          role: m.role as "user" | "assistant",
          content: m.content,
        });
      }

      const lastMsg = messages[messages.length - 1];
      const userText =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? "");

      if (!doStream) {
        // Non-streaming: collect and return
        const chunks: string[] = [];
        const fakeRes = {
          setHeader: () => {},
          flushHeaders: () => {},
          write: (data: string) => {
            chunks.push(data);
            return true;
          },
          end: () => {},
          on: () => fakeRes,
        } as unknown as typeof res;

        const sseStream = new SSEStream(fakeRes);
        await streamMessage({
          conversationId: conv.id,
          userId: user.id,
          userMessage: userText,
          model,
          maxTokens: 8096,
          autoApprove: { file_read: true, file_write: false, bash: false },
          apiKey: user.apiKey ?? process.env.ANTHROPIC_API_KEY,
          executor: legacyExecutor,
          stream: sseStream,
        });
        res.json({ content: chunks.join(""), model });
        return;
      }

      const sseStream = new SSEStream(res);
      req.on("close", () => sseStream.close());

      await streamMessage({
        conversationId: conv.id,
        userId: user.id,
        userMessage: userText,
        model,
        maxTokens: 8096,
        autoApprove: { file_read: true, file_write: false, bash: false },
        apiKey: user.apiKey ?? process.env.ANTHROPIC_API_KEY,
        executor: legacyExecutor,
        stream: sseStream,
      });
    } catch (err) {
      if (!res.headersSent) next(err);
    }
  },
);

// ── 404 + error handling ──────────────────────────────────────────────────────

app.use(notFoundHandler as express.RequestHandler);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(errorHandler as any);

// ── Start ─────────────────────────────────────────────────────────────────────

const server = createServer(app);

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event: "server_start",
    host: HOST,
    port: PORT,
    authProvider: process.env.AUTH_PROVIDER ?? "none",
    workDir: process.env.WORK_DIR ?? process.cwd(),
    dbPath: process.env.CC_DB_PATH ?? `${process.env.HOME ?? "/tmp"}/.claude/conversations.json`,
  }));
  console.log(`API server listening on http://${HOST}:${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown() {
  console.log("Shutting down API server...");
  server.close(() => {
    console.log("API server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, server };
