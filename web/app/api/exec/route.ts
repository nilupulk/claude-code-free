/**
 * POST /api/exec
 * Body: { cmd: string, args: string[], cwd?: string, env?: Record<string,string>, shell?: boolean, timeout?: number }
 *
 * Executes a command on the server and streams stdout/stderr as Server-Sent Events.
 *
 * Event stream format (each line prefixed with "data: "):
 *   { type: "pid",    pid: number }
 *   { type: "stdout", data: string }
 *   { type: "stderr", data: string }
 *   { type: "close",  code: number | null }
 *   { type: "error",  error: string }
 *
 * Security:
 *   - Only commands listed in ALLOWED_COMMANDS are permitted (unless EXEC_UNRESTRICTED=true).
 *   - cwd is sandboxed to SANDBOX_ROOT.
 *   - Timeout defaults to 30 s; maximum 300 s.
 */
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

const SANDBOX_ROOT = process.env.SANDBOX_ROOT ?? process.cwd();
const EXEC_UNRESTRICTED = process.env.EXEC_UNRESTRICTED === "true";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;

// Default allow-list — operators can extend via ALLOWED_COMMANDS env var
// (comma-separated list of additional binary names).
const BASE_ALLOWED = new Set([
  "git",
  "node",
  "npm",
  "npx",
  "bun",
  "bunx",
  "ls",
  "cat",
  "echo",
  "pwd",
  "find",
  "grep",
  "rg",
  "which",
  "env",
  "true",
  "false",
  "sh",
  "bash",
]);

const ALLOWED_COMMANDS: Set<string> = (() => {
  const extra = (process.env.ALLOWED_COMMANDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...BASE_ALLOWED, ...extra]);
})();

function isAllowed(cmd: string): boolean {
  if (EXEC_UNRESTRICTED) return true;
  const basename = path.basename(cmd);
  return ALLOWED_COMMANDS.has(basename);
}

function sandboxedCwd(cwd?: string): string {
  if (!cwd) return SANDBOX_ROOT;
  const resolved = path.resolve(cwd);
  if (!resolved.startsWith(SANDBOX_ROOT)) return SANDBOX_ROOT;
  return resolved;
}

function sse(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: NextRequest) {
  let body: {
    cmd?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean;
    timeout?: number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { cmd, args = [], cwd, env: extraEnv, shell = false } = body;
  const timeoutMs = Math.min(
    body.timeout ?? DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );

  if (!cmd) {
    return new Response(JSON.stringify({ error: "cmd is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAllowed(cmd)) {
    return new Response(
      JSON.stringify({ error: `Command not allowed: ${cmd}` }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const safeCwd = sandboxedCwd(cwd);
  const mergedEnv = extraEnv
    ? { ...process.env, ...extraEnv }
    : process.env;

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn(cmd, args, {
        cwd: safeCwd,
        env: mergedEnv as NodeJS.ProcessEnv,
        shell,
        timeout: timeoutMs,
      });

      // Send PID first so the client can track it
      controller.enqueue(sse({ type: "pid", pid: child.pid }));

      child.stdout?.on("data", (chunk: Buffer) => {
        controller.enqueue(sse({ type: "stdout", data: chunk.toString() }));
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        controller.enqueue(sse({ type: "stderr", data: chunk.toString() }));
      });

      child.on("close", (code) => {
        controller.enqueue(sse({ type: "close", code }));
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(sse({ type: "error", error: err.message }));
        controller.close();
      });

      // Abort if client disconnects
      request.signal.addEventListener("abort", () => {
        child.kill();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
