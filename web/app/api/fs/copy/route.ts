/**
 * POST /api/fs/copy
 * Body: { src: string, dest: string }
 *
 * Copies a file.
 * Security: both paths sandboxed to SANDBOX_ROOT.
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
  let body: { src?: string; dest?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { src, dest } = body;
  if (!src || !dest) {
    return NextResponse.json({ error: "src and dest are required" }, { status: 400 });
  }

  let resolvedSrc: string;
  let resolvedDest: string;
  try {
    resolvedSrc = sandboxed(src);
    resolvedDest = sandboxed(dest);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
  }

  try {
    await fs.copyFile(resolvedSrc, resolvedDest);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
