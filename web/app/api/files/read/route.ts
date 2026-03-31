import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  validatePathWithSymlinks,
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

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

/** Extensions treated as readable text */
const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "jsonc", "json5",
  "md", "mdx", "txt", "log",
  "html", "htm", "xml", "svg",
  "css", "scss", "sass", "less",
  "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp",
  "sh", "bash", "zsh", "fish",
  "yaml", "yml", "toml", "ini", "env",
  "graphql", "gql",
  "sql",
  "dockerfile",
  "gitignore", "gitattributes", "editorconfig",
  "prisma",
]);

const MAX_READ_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const requestId = request.headers.get("x-request-id") ?? undefined;

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = fileRateLimiter.check(ip);
  if (!rl.allowed) {
    return rateLimitResponse(rl) as unknown as NextResponse;
  }

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  const projectRoot = getProjectRoot();

  // ── Path validation (traversal + sensitive file protection) ───────────────
  let resolvedPath: string;
  try {
    resolvedPath = await validatePathWithSymlinks(filePath, projectRoot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied";
    logPathTraversalBlocked({ attemptedPath: filePath, ip, requestId });
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const stats = await fs.stat(resolvedPath);

    if (stats.isDirectory()) {
      return NextResponse.json({ error: "path is a directory" }, { status: 400 });
    }

    // ── File size limit ──────────────────────────────────────────────────────
    if (stats.size > MAX_READ_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum readable size (${MAX_READ_BYTES / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    const ext = path.extname(resolvedPath).slice(1).toLowerCase();

    // ── Binary image: return as base64 data URL ───────────────────────────────
    if (ext in IMAGE_MIME) {
      const buffer = await fs.readFile(resolvedPath);
      const base64 = buffer.toString("base64");

      logFileAccess({ path: resolvedPath, operation: "read", ip, requestId, success: true });

      return NextResponse.json({
        content: `data:${IMAGE_MIME[ext]};base64,${base64}`,
        isImage: true,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }

    // ── Unknown extension: require it to be in the text allowlist ─────────────
    // This prevents accidental reads of compiled binaries, key files, etc.
    const normalizedExt = ext || path.basename(resolvedPath).toLowerCase();
    if (ext && !TEXT_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type '.${ext}' is not supported for reading` },
        { status: 415 }
      );
    }

    // ── Binary file detection (look for null bytes in first 512 bytes) ────────
    const probe = await fs.open(resolvedPath, "r");
    try {
      const buf = Buffer.alloc(512);
      const { bytesRead } = await probe.read(buf, 0, 512, 0);
      if (buf.slice(0, bytesRead).includes(0)) {
        return NextResponse.json(
          { error: "Binary file cannot be read as text" },
          { status: 415 }
        );
      }
    } finally {
      await probe.close();
    }

    const content = await fs.readFile(resolvedPath, "utf-8");

    logFileAccess({ path: resolvedPath, operation: "read", ip, requestId, success: true });

    return NextResponse.json({
      content,
      isImage: normalizedExt === "svg",
      size: stats.size,
      modified: stats.mtime.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logFileAccess({ path: resolvedPath, operation: "read", ip, requestId, success: false, error: message });
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
