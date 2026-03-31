/**
 * GET /api/fs/list?path=<path>&withTypes=1
 *
 * Lists directory contents.
 * Without withTypes: { entries: [{ name: string }] }
 * With    withTypes: { entries: [{ name, isFile, isDirectory, isSymbolicLink }] }
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

  const withTypes = request.nextUrl.searchParams.get("withTypes") === "1";

  try {
    if (withTypes) {
      const dirents = await fs.readdir(resolved, { withFileTypes: true });
      return NextResponse.json({
        entries: dirents.map((d) => ({
          name: d.name,
          isFile: d.isFile(),
          isDirectory: d.isDirectory(),
          isSymbolicLink: d.isSymbolicLink(),
        })),
      });
    }

    const names = await fs.readdir(resolved);
    return NextResponse.json({ entries: names.map((name) => ({ name })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNotFound = message.includes("ENOENT");
    return NextResponse.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
