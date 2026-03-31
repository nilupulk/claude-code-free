import { scrubApiKey } from "./key-encryption";

export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.failed"
  | "tool.execute"
  | "file.read"
  | "file.write"
  | "command.execute"
  | "rate_limit.exceeded"
  | "path_traversal.blocked"
  | "csrf.blocked";

export interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  /** File path for file events, command name for command events */
  subject?: string;
  details?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

/** Keys whose values should always be redacted */
const SENSITIVE_KEY_PATTERN = /api[_-]?key|password|token|secret|credential|auth/i;

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = "****";
    } else if (typeof value === "string") {
      safe[key] = scrubApiKey(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Emit a structured JSON audit log entry.
 * These logs must never include raw API keys, passwords, or session tokens.
 */
export function auditLog(event: AuditEvent): void {
  const sanitized: AuditEvent = {
    ...event,
    error: event.error ? scrubApiKey(event.error) : undefined,
    details: event.details ? sanitizeDetails(event.details) : undefined,
  };
  const line = JSON.stringify(sanitized);
  if (event.success) {
    console.log(`[AUDIT] ${line}`);
  } else {
    console.warn(`[AUDIT] ${line}`);
  }
}

export function logFileAccess(params: {
  path: string;
  operation: "read" | "write";
  userId?: string;
  ip?: string;
  requestId?: string;
  success: boolean;
  error?: string;
}): void {
  auditLog({
    type: params.operation === "read" ? "file.read" : "file.write",
    timestamp: new Date().toISOString(),
    subject: params.path,
    userId: params.userId,
    ip: params.ip,
    requestId: params.requestId,
    success: params.success,
    error: params.error,
  });
}

export function logCommandExecution(params: {
  command: string;
  args: string[];
  userId?: string;
  ip?: string;
  requestId?: string;
  success: boolean;
  error?: string;
}): void {
  auditLog({
    type: "command.execute",
    timestamp: new Date().toISOString(),
    subject: params.command,
    userId: params.userId,
    ip: params.ip,
    requestId: params.requestId,
    success: params.success,
    error: params.error,
    details: { args: params.args },
  });
}

export function logAuthEvent(params: {
  type: "auth.login" | "auth.logout" | "auth.failed";
  userId?: string;
  ip?: string;
  requestId?: string;
  reason?: string;
}): void {
  auditLog({
    type: params.type,
    timestamp: new Date().toISOString(),
    userId: params.userId,
    ip: params.ip,
    requestId: params.requestId,
    success: params.type !== "auth.failed",
    error: params.reason,
  });
}

export function logRateLimitExceeded(params: {
  ip: string;
  endpoint: string;
  retryAfterMs: number;
}): void {
  auditLog({
    type: "rate_limit.exceeded",
    timestamp: new Date().toISOString(),
    ip: params.ip,
    subject: params.endpoint,
    success: false,
    details: { retryAfterMs: params.retryAfterMs },
  });
}

export function logPathTraversalBlocked(params: {
  attemptedPath: string;
  ip?: string;
  requestId?: string;
}): void {
  auditLog({
    type: "path_traversal.blocked",
    timestamp: new Date().toISOString(),
    ip: params.ip,
    requestId: params.requestId,
    subject: params.attemptedPath,
    success: false,
    error: "Path traversal attempt blocked",
  });
}
