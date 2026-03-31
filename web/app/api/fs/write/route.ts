/**
 * POST /api/fs/write
 * Body: { path: string, content: string, encoding?: "utf-8" | "base64" }
 *
 * Writes content to a file. Creates parent directories if needed.
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
  let body: { path?: string; content?: string; encoding?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { path: filePath, content, encoding = "utf-8" } = body;
  if (!filePath || content === undefined) {
    return NextResponse.json({ error: "path and content are required" }, { status: 400 });
  }

  let resolved: string;
  try {
    resolved = sandboxed(filePath);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
  }

  try {
    // Ensure parent directories exist
    await fs.mkdir(path.dirname(resolved), { recursive: true });

    if (encoding === "base64") {
      const buf = Buffer.from(content, "base64");
      await fs.writeFile(resolved, buf);
    } else {
      await fs.writeFile(resolved, content, "utf-8");
    }

    const stats = await fs.stat(resolved);
    return NextResponse.json({ success: true, size: stats.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
