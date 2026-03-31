/**
 * GET /api/fs/read?path=<path>&encoding=utf-8
 *
 * Reads a file and returns its content.
 * Text files: { content: string, encoding: "utf-8" }
 * Binary files: { content: "<base64>", encoding: "base64" }
 *
 * Security: path is resolved and sandboxed to SANDBOX_ROOT.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SANDBOX_ROOT = process.env.SANDBOX_ROOT ?? process.cwd();

function sandboxed(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw Object.assign(new Error("Access denied: path outside sandbox"), { status: 403 });
  }
  return resolved;
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path");
  if (!rawPath) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  let resolved: string;
  try {
    resolved = sandboxed(rawPath);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
  }

  const encoding = request.nextUrl.searchParams.get("encoding") ?? "detect";

  try {
    const stats = await fs.stat(resolved);
    if (stats.isDirectory()) {
      return NextResponse.json({ error: "path is a directory" }, { status: 400 });
    }

    const ext = resolved.split(".").pop()?.toLowerCase() ?? "";
    const binaryExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "pdf", "zip", "gz", "wasm"]);
    const isBinary = binaryExts.has(ext) || encoding === "binary";

    if (isBinary) {
      const buf = await fs.readFile(resolved);
      return NextResponse.json({
        content: buf.toString("base64"),
        encoding: "base64",
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }

    const content = await fs.readFile(resolved, "utf-8");
    return NextResponse.json({
      content,
      encoding: "utf-8",
      size: stats.size,
      modified: stats.mtime.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNotFound = message.includes("ENOENT") || message.includes("no such file");
    return NextResponse.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
