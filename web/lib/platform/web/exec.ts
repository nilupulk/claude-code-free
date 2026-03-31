/**
 * Browser command-executor shim.
 * Proxies spawn/exec to the backend `/api/exec` route which streams
 * stdout/stderr via Server-Sent Events.
 */

import type { CommandExecutor, ChildProcessLike, SpawnOptions } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiBase(): string {
  return typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000");
}

type DataListener = (data: string) => void;
type CloseListener = (code: number | null) => void;
type ErrorListener = (err: Error) => void;

// ---------------------------------------------------------------------------
// spawn — returns a ChildProcessLike backed by an SSE stream
// ---------------------------------------------------------------------------

function spawn(cmd: string, args: string[], options?: SpawnOptions): ChildProcessLike {
  const stdoutListeners: DataListener[] = [];
  const stderrListeners: DataListener[] = [];
  const closeListeners: CloseListener[] = [];
  const errorListeners: ErrorListener[] = [];

  let abortController: AbortController | null = null;
  let pid: number | undefined;

  // Build SSE connection lazily — start immediately
  const start = async () => {
    abortController = new AbortController();
    try {
      const res = await fetch(`${apiBase()}/api/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd,
          args,
          cwd: options?.cwd,
          env: options?.env,
          shell: options?.shell ?? false,
          timeout: options?.timeout,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const err = new Error(body.error ?? "exec failed");
        for (const h of errorListeners) h(err);
        for (const h of closeListeners) h(1);
        return;
      }

      // The backend responds with an event-stream
      const reader = res.body?.getReader();
      if (!reader) {
        for (const h of closeListeners) h(0);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const event = JSON.parse(json) as {
              type: "pid" | "stdout" | "stderr" | "close" | "error";
              data?: string;
              pid?: number;
              code?: number;
              error?: string;
            };
            switch (event.type) {
              case "pid":
                pid = event.pid;
                break;
              case "stdout":
                if (event.data != null) {
                  for (const h of stdoutListeners) h(event.data);
                }
                break;
              case "stderr":
                if (event.data != null) {
                  for (const h of stderrListeners) h(event.data);
                }
                break;
              case "close":
                for (const h of closeListeners) h(event.code ?? 0);
                return;
              case "error":
                for (const h of errorListeners) h(new Error(event.error ?? "unknown"));
                for (const h of closeListeners) h(1);
                return;
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
      // Stream ended without explicit close event
      for (const h of closeListeners) h(0);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      for (const h of errorListeners) h(err instanceof Error ? err : new Error(String(err)));
      for (const h of closeListeners) h(1);
    }
  };

  // Fire and forget — errors surface through event listeners
  void start();

  // ---------------------------------------------------------------------------
  // stdin shim — sends input to the backend process
  // ---------------------------------------------------------------------------

  const stdinObj = {
    write(_data: string): void {
      // TODO: wire up to a stdin endpoint when interactive commands are needed
    },
    end(): void {
      abortController?.abort();
    },
  };

  // ---------------------------------------------------------------------------
  // stdout / stderr event emitters
  // ---------------------------------------------------------------------------

  const stdoutObj = {
    on(event: string, handler: DataListener) {
      if (event === "data") stdoutListeners.push(handler);
    },
  };

  const stderrObj = {
    on(event: string, handler: DataListener) {
      if (event === "data") stderrListeners.push(handler);
    },
  };

  // ---------------------------------------------------------------------------
  // ChildProcessLike object
  // ---------------------------------------------------------------------------

  const child: ChildProcessLike = {
    get pid() {
      return pid;
    },
    stdout: stdoutObj,
    stderr: stderrObj,
    stdin: stdinObj,

    on(event: string, handler: (...args: unknown[]) => void): typeof child {
      if (event === "close") closeListeners.push(handler as CloseListener);
      else if (event === "error") errorListeners.push(handler as ErrorListener);
      return child;
    },

    kill(_signal?: string): void {
      abortController?.abort();
    },
  };

  return child;
}

// ---------------------------------------------------------------------------
// exec — wraps spawn and buffers output
// ---------------------------------------------------------------------------

async function execCommand(
  cmd: string,
  options?: SpawnOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const parts = cmd.split(/\s+/);
    const [bin, ...args] = parts;
    const child = spawn(bin, args, options);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += String(data);
    });
    child.stderr?.on("data", (data) => {
      stderr += String(data);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const webExec: CommandExecutor = {
  spawn,
  exec: execCommand,
};
