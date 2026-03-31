/**
 * POST /api/fs/symlink
 * Body: { target: string, path: string }
 *
 * Creates a symbolic link.
 * Security: path sandboxed to SANDBOX_ROOT.
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

export async function POST(request: NextRequest) {
  let body: { target?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { target, path: linkPath } = body;
  if (!target || !linkPath) {
    return NextResponse.json({ error: "target and path are required" }, { status: 400 });
  }

  let resolvedLink: string;
  try {
    resolvedLink = sandboxed(linkPath);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
  }

  try {
    await fs.symlink(target, resolvedLink);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
