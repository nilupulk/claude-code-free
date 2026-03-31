import express from "express";
import { createServer } from "http";
import { mkdirSync } from "fs";
import path from "path";
import { spawn } from "node-pty";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import { ConnectionRateLimiter } from "./auth.js";
import { SessionManager } from "./session-manager.js";
import { UserStore } from "./user-store.js";
import { createAdminRouter } from "./admin.js";
import { createAnalyticsRouter } from "../analytics/router.js";
import { SessionStore } from "./auth/adapter.js";
import { TokenAuthAdapter } from "./auth/token-auth.js";
import { OAuthAdapter } from "./auth/oauth-auth.js";
import { ApiKeyAdapter } from "./auth/apikey-auth.js";
import type { AuthAdapter, AuthUser } from "./auth/adapter.js";
import { initSentry, sentryErrorHandler, sentryUserMiddleware } from "../observability/sentry.js";
import { logger, requestLoggingMiddleware } from "../observability/logger.js";
import {
  metricsMiddleware,
  metricsHandler,
  activeSessions,
  conversationsCreatedTotal,
  startEventLoopSampler,
} from "../observability/metrics.js";
import {
  livenessHandler,
  readinessHandler,
  startupHandler,
  markStartupComplete,
  registerAnthropicCheck,
} from "../observability/health.js";

// Initialise Sentry before anything else so it catches startup errors.
initSentry();

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? "10", 10);
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER ?? "3", 10);
const MAX_SESSIONS_PER_HOUR = parseInt(process.env.MAX_SESSIONS_PER_HOUR ?? "10", 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
const GRACE_PERIOD_MS = parseInt(process.env.SESSION_GRACE_MS ?? String(5 * 60_000), 10);
const SCROLLBACK_BYTES = parseInt(process.env.SCROLLBACK_BYTES ?? String(100 * 1024), 10);
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const AUTH_PROVIDER = process.env.AUTH_PROVIDER ?? "token";
const SESSION_SECRET = process.env.SESSION_SECRET ?? crypto.randomUUID();
const USER_HOME_BASE = process.env.USER_HOME_BASE ?? "/home/claude/users";

// ── Auth adapter ──────────────────────────────────────────────────────────────

const sessionStore = new SessionStore(SESSION_SECRET);

let authAdapter: AuthAdapter;
switch (AUTH_PROVIDER) {
  case "oauth":
    authAdapter = new OAuthAdapter(sessionStore);
    break;
  case "apikey":
    authAdapter = new ApiKeyAdapter(sessionStore);
    break;
  default:
    authAdapter = new TokenAuthAdapter();
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Observability middleware — mount first so every request is timed and logged.
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);

const server = createServer(app);

// Register auth routes (login, callback, logout) before static files so they
// take priority over any index.html fallback.
authAdapter.setupRoutes(app);

// Sentry user context — enriches error reports with the authenticated user.
app.use(sentryUserMiddleware as express.RequestHandler);

// ── User store ────────────────────────────────────────────────────────────────

const userStore = new UserStore();

// ── Session Manager ───────────────────────────────────────────────────────────

/** Returns the user-specific home directory, creating it if needed. */
function userHomeDir(userId: string): string {
  const dir = path.join(USER_HOME_BASE, userId);
  try {
    mkdirSync(path.join(dir, ".claude"), { recursive: true });
  } catch {
    // Already exists or no permission — fail silently; PTY spawn will surface any real issue.
  }
  return dir;
}

const sessionManager = new SessionManager(
  MAX_SESSIONS,
  (cols, rows, user?: AuthUser) => {
    const userId = user?.id ?? "default";
    const home = userHomeDir(userId);
    return spawn(CLAUDE_BIN, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.WORK_DIR ?? home,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        HOME: home,
        // Inject the user's own API key when using apikey auth provider.
        ...(user?.apiKey ? { ANTHROPIC_API_KEY: user.apiKey } : {}),
      },
    });
  },
  GRACE_PERIOD_MS,
  SCROLLBACK_BYTES,
  MAX_SESSIONS_PER_USER,
  MAX_SESSIONS_PER_HOUR,
);

// ── Health checks ─────────────────────────────────────────────────────────────

// Register the Anthropic API reachability check.
registerAnthropicCheck();

// Liveness — is the process alive?
app.get("/health", livenessHandler);
app.get("/health/live", livenessHandler);

// Readiness — can it serve traffic? (runs all registered checks)
app.get("/health/ready", readinessHandler as express.RequestHandler);

// Startup — did initialisation finish? (used by K8s startupProbe)
app.get("/health/startup", startupHandler);

// ── Metrics ───────────────────────────────────────────────────────────────────

// Prometheus scrape endpoint — protected to localhost-only in production via
// network policy / ingress rules; no auth here to keep Prometheus config simple.
app.get("/metrics", metricsHandler as express.RequestHandler);

// ── API routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/sessions — list the current user's sessions.
 * Requires authentication. Admins see all sessions.
 */
app.get("/api/sessions", authAdapter.requireAuth.bind(authAdapter), (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user;
  const sessions = user.isAdmin
    ? sessionManager.getAllSessions()
    : sessionManager.getUserSessions(user.id);
  res.json(sessions);
});

/**
 * DELETE /api/sessions/:token — kill a session.
 * Users may only kill their own sessions; admins may kill any session.
 */
app.delete(
  "/api/sessions/:token",
  authAdapter.requireAuth.bind(authAdapter),
  (req, res) => {
    const { token } = req.params;
    const user = (req as express.Request & { user: AuthUser }).user;
    const session = sessionManager.getSession(token);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!user.isAdmin && session.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    sessionManager.destroySession(token);
    res.status(204).end();
  },
);

// Admin routes — protected by admin-role check inside the router.
app.use(
  "/admin",
  authAdapter.requireAuth.bind(authAdapter),
  createAdminRouter(sessionManager, userStore),
);

// Analytics routes — ingest is public (events are anonymous); summary/export are admin-only.
app.use("/analytics", createAnalyticsRouter());

// Static frontend (served last so auth/admin routes win).
const publicDir = path.join(import.meta.dirname, "public");
app.use(express.static(publicDir));

app.get("/", authAdapter.requireAuth.bind(authAdapter), (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Sentry error handler — must be last, after all routes.
app.use(sentryErrorHandler as express.ErrorRequestHandler);

// ── WebSocket server ──────────────────────────────────────────────────────────

/**
 * Extend IncomingMessage to carry the authenticated user through from
 * verifyClient to the connection handler without re-authenticating.
 */
interface AuthedRequest extends IncomingMessage {
  _authUser?: AuthUser;
}

const rateLimiter = new ConnectionRateLimiter();
const rateLimiterCleanup = setInterval(() => rateLimiter.cleanup(), 5 * 60_000);

const wss = new WebSocketServer({
  server,
  path: "/ws",
  verifyClient: ({ req, origin }, callback) => {
    // Origin check
    if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
      logger.warn({ origin }, "Rejected connection from disallowed origin");
      callback(false, 403, "Forbidden origin");
      return;
    }

    // Authenticate the user
    const user = authAdapter.authenticate(req as IncomingMessage);
    if (!user) {
      logger.warn("Rejected WebSocket connection: unauthenticated");
      callback(false, 401, "Unauthorized");
      return;
    }

    // IP-level rate limit (guards against connection floods from a single IP)
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    if (!rateLimiter.allow(ip)) {
      logger.warn({ ip }, "Rate limited WebSocket connection");
      callback(false, 429, "Too many connections");
      return;
    }

    // Determine whether this is a resume (reattach) request.
    // Rate limits only apply to new session creation, not resumes.
    const wsUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const isResume = wsUrl.searchParams.has("resume");

    if (!isResume) {
      // Per-user rate limit (hourly new-session quota)
      if (sessionManager.isUserRateLimited(user.id)) {
        const retryAfter = sessionManager.retryAfterSeconds(user.id);
        logger.warn({ userId: user.id, retryAfter }, "Per-user rate limit reached");
        callback(false, 429, "Too Many Requests", { "Retry-After": String(retryAfter) });
        return;
      }

      // Per-user concurrent session limit
      if (sessionManager.isUserAtConcurrentLimit(user.id)) {
        logger.warn({ userId: user.id }, "Concurrent session limit reached");
        callback(false, 429, "Session limit reached");
        return;
      }
    }

    // Attach user to request for the connection handler
    (req as AuthedRequest)._authUser = user;
    callback(true);
  },
});

wss.on("connection", (ws, req) => {
  const user = (req as AuthedRequest)._authUser;
  if (!user) {
    // Should never happen — verifyClient already checked, but be safe.
    ws.close(1008, "Unauthenticated");
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  logger.info({ ip, userId: user.id }, "New WebSocket connection");

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const cols = parseInt(url.searchParams.get("cols") ?? "80", 10);
  const rows = parseInt(url.searchParams.get("rows") ?? "24", 10);
  const resumeToken = url.searchParams.get("resume");

  // Try to resume an existing session owned by this user
  if (resumeToken) {
    const stored = sessionManager.getSession(resumeToken);
    // Users may only resume their own sessions (admins can resume any)
    if (stored && (user.isAdmin || stored.userId === user.id)) {
      const resumed = sessionManager.resume(resumeToken, ws, cols, rows);
      if (resumed) {
        activeSessions.set(sessionManager.activeCount);
        return;
      }
    }
    logger.info(
      { tokenPrefix: resumeToken.slice(0, 8) },
      "Resume token not found or not owned — starting fresh",
    );
  }

  // Global capacity check
  if (sessionManager.isFull) {
    ws.send(JSON.stringify({ type: "error", message: "Max sessions reached. Try again later." }));
    ws.close(1013, "Max sessions reached");
    return;
  }

  const token = sessionManager.create(ws, cols, rows, user);
  if (token) {
    conversationsCreatedTotal.inc();
    activeSessions.set(sessionManager.activeCount);

    // Track the user in the user store
    userStore.touch(user.id, { email: user.email, name: user.name });

    // Release the user slot when this session ends
    const stored = sessionManager.getSession(token);
    if (stored) {
      stored.pty.onExit(() => {
        userStore.release(user.id);
        activeSessions.set(sessionManager.activeCount);
      });
    }

    ws.send(JSON.stringify({ type: "session", token }));
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown() {
  logger.info("Shutting down...");
  clearInterval(rateLimiterCleanup);
  sessionManager.destroyAll();
  wss.close(() => {
    server.close(() => {
      logger.info("Server closed.");
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────

// Start background samplers
startEventLoopSampler();

server.listen(PORT, HOST, () => {
  logger.info(
    {
      host: HOST,
      port: PORT,
      maxSessions: MAX_SESSIONS,
      maxSessionsPerUser: MAX_SESSIONS_PER_USER,
      gracePeriodSecs: GRACE_PERIOD_MS / 1000,
      scrollbackKb: Math.round(SCROLLBACK_BYTES / 1024),
      authProvider: AUTH_PROVIDER,
    },
    `PTY server listening on http://${HOST}:${PORT}`,
  );

  // Signal to K8s startup probe that the server is ready.
  markStartupComplete(true);
});

export { app, server, sessionManager, wss };
