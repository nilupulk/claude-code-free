/**
 * GET /api/fs/readlink?path=<path>
 *
 * Returns the target of a symbolic link.
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

  try {
    const target = await fs.readlink(resolved);
    return NextResponse.json({ target });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
