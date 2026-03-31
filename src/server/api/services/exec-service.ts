/**
 * Exec service — run shell commands with streaming stdout/stderr.
 *
 * Each command gets a unique ID. Stdout/stderr lines are buffered so callers
 * that miss the initial output can still get a partial scrollback.
 */

import { spawn } from "child_process";
import { db, flush } from "../db/connection.js";
import type { DbExecProcess } from "../db/schema.js";
import { ApiError } from "../middleware/error-handler.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcessHandle {
  db: DbExecProcess;
  lines: string[];
  kill: () => void;
  onLine: ((line: string) => void) | null;
  onDone: ((code: number | null) => void) | null;
}

const handles = new Map<string, ProcessHandle>();

// ── Spawn ─────────────────────────────────────────────────────────────────────

const WORK_DIR = process.env.WORK_DIR ?? process.cwd();
const MAX_LINES = 10_000;
const DEFAULT_TIMEOUT_MS = 60_000;

export interface ExecOptions {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExecResult {
  id: string;
  pid?: number;
}

export function startProcess(opts: ExecOptions): ExecResult {
  const id = crypto.randomUUID();
  const now = Date.now();
  const dbProc: DbExecProcess = {
    id,
    command: opts.command,
    status: "running",
    startedAt: now,
  };
  db().processes[id] = dbProc;

  const child = spawn("sh", ["-c", opts.command], {
    cwd: opts.cwd ?? WORK_DIR,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: "pipe",
  });

  dbProc.pid = child.pid;

  const handle: ProcessHandle = {
    db: dbProc,
    lines: [],
    kill: () => child.kill("SIGTERM"),
    onLine: null,
    onDone: null,
  };
  handles.set(id, handle);

  function pushLine(line: string) {
    if (handle.lines.length >= MAX_LINES) handle.lines.shift();
    handle.lines.push(line);
    handle.onLine?.(line);
  }

  // Buffer stdout/stderr
  let stdoutBuf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const l of lines) pushLine(l);
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split("\n");
    stderrBuf = lines.pop() ?? "";
    for (const l of lines) pushLine(`[stderr] ${l}`);
  });

  const timeout = setTimeout(() => {
    if (dbProc.status === "running") {
      child.kill("SIGKILL");
      pushLine("[timeout] Process killed after timeout.");
    }
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  child.on("close", (code) => {
    clearTimeout(timeout);
    dbProc.status = code === 0 ? "done" : "error";
    dbProc.exitCode = code ?? undefined;
    dbProc.endedAt = Date.now();
    if (stdoutBuf) pushLine(stdoutBuf);
    if (stderrBuf) pushLine(`[stderr] ${stderrBuf}`);
    handle.onDone?.(code);
    // Clean up after 5 minutes
    setTimeout(() => handles.delete(id), 5 * 60_000);
    flush();
  });

  return { id, pid: child.pid };
}

// ── Status ────────────────────────────────────────────────────────────────────

export function getProcessStatus(id: string): DbExecProcess {
  const proc = db().processes[id];
  if (!proc) throw ApiError.notFound("Process");
  return proc;
}

// ── Kill ──────────────────────────────────────────────────────────────────────

export function killProcess(id: string): void {
  const handle = handles.get(id);
  if (!handle) throw ApiError.notFound("Process");
  handle.kill();
  handle.db.status = "killed";
  handle.db.endedAt = Date.now();
}

// ── Streaming output ──────────────────────────────────────────────────────────

/**
 * Subscribe to process output. The callback is called immediately with all
 * buffered lines, then called for each new line until done.
 * Returns an unsubscribe function.
 */
export function subscribeToProcess(
  id: string,
  onLine: (line: string) => void,
  onDone: (code: number | null) => void,
): () => void {
  const handle = handles.get(id);
  if (!handle) {
    // Process already finished — check db
    const proc = db().processes[id];
    if (!proc) throw ApiError.notFound("Process");
    onDone(proc.exitCode ?? null);
    return () => {};
  }

  // Replay buffered lines
  for (const line of handle.lines) onLine(line);

  // If already done
  if (handle.db.status !== "running") {
    onDone(handle.db.exitCode ?? null);
    return () => {};
  }

  handle.onLine = onLine;
  handle.onDone = onDone;

  return () => {
    if (handle.onLine === onLine) handle.onLine = null;
    if (handle.onDone === onDone) handle.onDone = null;
  };
}

// ── ExecService class (for DI into ClaudeService) ─────────────────────────────

export class ExecService {
  start = startProcess;
  status = getProcessStatus;
  kill = killProcess;
  subscribe = subscribeToProcess;
}
