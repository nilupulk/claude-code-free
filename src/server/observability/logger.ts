/**
 * Structured logger built on pino.
 *
 * - Production: JSON output to stdout (collected by Docker / K8s log drivers)
 * - Development: pretty-printed with colors via pino-pretty
 *
 * Every log entry automatically includes:
 *   timestamp (ISO 8601), level, requestId, userId, message, context
 *
 * Sensitive fields are redacted via the scrubber before they reach any sink.
 */

import pino from "pino";
import { PINO_REDACT_PATHS, scrubString } from "./scrubber.js";

const isDev = process.env.NODE_ENV !== "production";

// ── Transport ─────────────────────────────────────────────────────────────────

const transport = isDev
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    })
  : undefined; // stdout JSON in production

// ── Root logger ───────────────────────────────────────────────────────────────

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  transport,
);

// ── Child logger factory ──────────────────────────────────────────────────────

/**
 * Create a child logger that stamps every entry with a requestId and optional userId.
 * Use this inside Express middleware or WebSocket handlers.
 *
 * @example
 * const log = requestLogger(req.id, req.user?.id);
 * log.info({ route: req.path }, "Handled request");
 */
export function requestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    ...(userId ? { userId: scrubString(userId) } : {}),
  });
}

/**
 * Create a child logger bound to a named component / subsystem.
 *
 * @example
 * const log = componentLogger("session-manager");
 * log.warn({ token }, "Session not found");
 */
export function componentLogger(component: string) {
  return logger.child({ component });
}

// ── Express middleware ────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      log: pino.Logger;
    }
  }
}

/**
 * Attach a request-scoped logger to `req.log` and emit access log entries.
 * Mounts before route handlers.
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.id = (req.headers["x-request-id"] as string) ?? randomUUID();
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  req.log = requestLogger(req.id, userId);

  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level](
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: ms,
        contentLength: res.getHeader("content-length"),
        userAgent: req.headers["user-agent"],
      },
      `${req.method} ${req.url} ${res.statusCode} ${ms}ms`,
    );
  });

  next();
}
