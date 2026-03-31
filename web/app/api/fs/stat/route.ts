/**
 * GET /api/fs/stat?path=<path>&lstat=1
 *
 * Returns file metadata. Use lstat=1 to stat a symlink itself.
 *
 * Security: sandboxed to SANDBOX_ROOT.
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

  const useLstat = request.nextUrl.searchParams.get("lstat") === "1";

  try {
    const s = useLstat ? await fs.lstat(resolved) : await fs.stat(resolved);
    return NextResponse.json({
      size: s.size,
      mode: s.mode,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: s.isSymbolicLink(),
      mtime: s.mtime.toISOString(),
      ctime: s.ctime.toISOString(),
      atime: s.atime.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNotFound = message.includes("ENOENT");
    return NextResponse.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
