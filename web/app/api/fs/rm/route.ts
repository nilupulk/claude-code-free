/**
 * POST /api/fs/rm
 * Body: { path: string, recursive?: boolean, force?: boolean }
 *
 * Removes a file or directory.
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

export async function POST(request: NextRequest) {
  let body: { path?: string; recursive?: boolean; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { path: filePath, recursive = false, force = false } = body;
  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  let resolved: string;
  try {
    resolved = sandboxed(filePath);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
  }

  // Prevent removing the sandbox root itself
  if (resolved === SANDBOX_ROOT) {
    return NextResponse.json({ error: "Cannot remove sandbox root" }, { status: 403 });
  }

  try {
    await fs.rm(resolved, { recursive, force });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
