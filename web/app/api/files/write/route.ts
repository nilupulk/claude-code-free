import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  validatePath,
  getProjectRoot,
} from "../../../../../src/server/security/path-validator";
import {
  fileRateLimiter,
  getClientIp,
  rateLimitResponse,
} from "../../../../../src/server/security/rate-limiter";
import {
  logFileAccess,
  logPathTraversalBlocked,
} from "../../../../../src/server/security/audit-log";
import { requireString } from "../../../../../src/server/security/sanitize";

const MAX_WRITE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const requestId = request.headers.get("x-request-id") ?? undefined;

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = fileRateLimiter.check(ip);
  if (!rl.allowed) {
    return rateLimitResponse(rl) as unknown as NextResponse;
  }

  let body: { path?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  let filePath: string;
  let content: string;

  try {
    filePath = requireString(body.path, "path");
    content = requireString(body.content, "content");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // ── Content size limit ─────────────────────────────────────────────────────
  const contentBytes = Buffer.byteLength(content, "utf-8");
  if (contentBytes > MAX_WRITE_BYTES) {
    return NextResponse.json(
      { error: `Content exceeds maximum write size (${MAX_WRITE_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }

  const projectRoot = getProjectRoot();

  // ── Path validation (traversal + sensitive file protection) ───────────────
  let resolvedPath: string;
  try {
    // Use synchronous validatePath for writes (file may not exist yet)
    resolvedPath = validatePath(filePath, projectRoot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied";
    logPathTraversalBlocked({ attemptedPath: filePath, ip, requestId });
    return NextResponse.json({ error: message }, { status: 403 });
  }

  // ── Ensure parent directory exists within project root ────────────────────
  const parentDir = path.dirname(resolvedPath);
  try {
    // validatePath will throw if parentDir escapes the project root
    validatePath(parentDir, projectRoot);
  } catch {
    return NextResponse.json({ error: "Access denied: invalid target directory" }, { status: 403 });
  }

  try {
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(resolvedPath, content, "utf-8");
    const stats = await fs.stat(resolvedPath);

    logFileAccess({ path: resolvedPath, operation: "write", ip, requestId, success: true });

    return NextResponse.json({ success: true, size: stats.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logFileAccess({ path: resolvedPath, operation: "write", ip, requestId, success: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
