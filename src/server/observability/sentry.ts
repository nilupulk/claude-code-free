/**
 * Sentry server-side initialisation.
 *
 * Call `initSentry()` once at the very top of your entry point (before any
 * imports that might throw), then attach `sentryErrorHandler` after all other
 * Express error-handling middleware.
 *
 * Environment variables:
 *   SENTRY_DSN           — Sentry project DSN (required to enable)
 *   SENTRY_ENVIRONMENT   — "production" | "preview" | "development"
 *   SENTRY_RELEASE       — git SHA injected at build time (optional)
 *   SENTRY_TRACES_SAMPLE_RATE — 0–1, default 0.1 in production
 */

import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

let initialised = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("Sentry disabled — SENTRY_DSN not set");
    return;
  }

  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  const release = process.env.SENTRY_RELEASE;
  const tracesSampleRate = parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? (environment === "production" ? "0.1" : "1.0"),
  );

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate,
    // Attach request data (URL, method, headers) to every event
    integrations: [
      Sentry.httpIntegration({ tracing: true }),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // Strip any residual API keys from exception messages / stack traces
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) {
            ex.value = ex.value.replace(/sk-ant-[A-Za-z0-9\-_]{8,}/g, "sk-ant-[REDACTED]");
          }
        }
      }
      return event;
    },
  });

  initialised = true;
  logger.info({ environment, release, tracesSampleRate }, "Sentry initialised");
}

/** Enrich Sentry scope with authenticated user info on each request. */
export function sentryUserMiddleware(
  req: Request & { user?: { id: string; email?: string; name?: string; isAdmin?: boolean } },
  _res: Response,
  next: NextFunction,
): void {
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
      username: req.user.name,
      // @ts-expect-error — custom field
      isAdmin: req.user.isAdmin,
    });
  }
  next();
}

/**
 * Express error handler — must be registered AFTER all other middleware and routes.
 *
 * app.use(sentryErrorHandler);
 */
export function sentryErrorHandler(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (initialised) {
    Sentry.captureException(err);
  }
  next(err);
}

/**
 * Manually capture an exception with optional extra context.
 * Safe to call even when Sentry is not initialised.
 */
export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialised) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

/**
 * Add a breadcrumb (informational event) to the current Sentry scope.
 * Breadcrumbs appear in the Sentry issue timeline for context.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info",
): void {
  if (!initialised) return;
  Sentry.addBreadcrumb({ category, message, data, level });
}
