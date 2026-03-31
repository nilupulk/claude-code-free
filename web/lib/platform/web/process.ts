/**
 * Browser process shim.
 * Replaces Node's `process` global so code that reads process.env,
 * process.stdout.columns, etc. works in the browser without modification.
 *
 * Environment variables and cwd are fetched from the backend at init time.
 * stdout/stdin are wired to a virtual terminal element via the event system.
 */

import type { ProcessInfo, WritableStreamLike, ReadableStreamLike } from "../types";

// ---------------------------------------------------------------------------
// State (populated by initProcessInfo at app startup)
// ---------------------------------------------------------------------------

let _env: Record<string, string | undefined> = {};
let _cwd = "/";

/** Populate env and cwd from the backend. Call once at startup. */
export async function initProcessInfo(): Promise<void> {
  try {
    const base =
      typeof window !== "undefined"
        ? ""
        : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000");

    const [envRes, cwdRes] = await Promise.all([
      fetch(`${base}/api/env`),
      fetch(`${base}/api/cwd`),
    ]);

    if (envRes.ok) {
      const data = await envRes.json();
      _env = data.env ?? {};
    }
    if (cwdRes.ok) {
      const data = await cwdRes.json();
      _cwd = data.cwd ?? "/";
    }
  } catch {
    // Fall back to empty env and "/" cwd
  }
}

// ---------------------------------------------------------------------------
// stdout / stderr — virtual streams backed by an in-page output buffer
// ---------------------------------------------------------------------------

type StreamListener = (...args: unknown[]) => void;

function makeWritableStream(name: "stdout" | "stderr"): WritableStreamLike {
  const listeners: Map<string, Set<StreamListener>> = new Map();

  const charWidth = 8; // px per character (approximate monospace)

  function getColumns(): number {
    if (typeof window !== "undefined") {
      return Math.max(40, Math.floor(window.innerWidth / charWidth));
    }
    return 80;
  }

  function getRows(): number {
    if (typeof window !== "undefined") {
      return Math.max(10, Math.floor(window.innerHeight / charWidth));
    }
    return 24;
  }

  const stream: WritableStreamLike = {
    get columns() {
      return getColumns();
    },
    get rows() {
      return getRows();
    },

    write(data: string): boolean {
      // Emit to any registered 'data' listeners (e.g. terminal component)
      const handlers = listeners.get("data");
      if (handlers) {
        for (const h of handlers) h(data);
      }
      return true;
    },

    on(event: string, handler: StreamListener): typeof stream {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      // Auto-emit 'resize' for window resize
      if (event === "resize" && typeof window !== "undefined") {
        window.addEventListener("resize", () => handler(getColumns(), getRows()));
      }
      return stream;
    },

    removeListener(event: string, handler: StreamListener): typeof stream {
      listeners.get(event)?.delete(handler);
      return stream;
    },
  };

  return stream;
}

// ---------------------------------------------------------------------------
// stdin — keyboard event adapter
// ---------------------------------------------------------------------------

function makeStdin(): ReadableStreamLike {
  const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  const stdin: ReadableStreamLike = {
    isTTY: true,

    on(event: string, handler: (...args: unknown[]) => void): typeof stdin {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);

      if (event === "data" && typeof window !== "undefined") {
        window.addEventListener("keydown", (e: KeyboardEvent) => {
          // Convert DOM key events to raw terminal bytes
          const key = domKeyToAnsi(e);
          if (key) handler(key);
        });
      }
      return stdin;
    },

    removeListener(event: string, handler: (...args: unknown[]) => void): typeof stdin {
      listeners.get(event)?.delete(handler);
      return stdin;
    },

    setRawMode(_enabled: boolean): void {
      // No-op — browser keyboard input is always "raw"
    },
  };

  return stdin;
}

/** Convert a DOM KeyboardEvent to an ANSI escape sequence or printable char. */
function domKeyToAnsi(e: KeyboardEvent): string | null {
  if (e.ctrlKey) {
    const code = e.key.toLowerCase().charCodeAt(0) - 96;
    if (code >= 1 && code <= 26) return String.fromCharCode(code);
  }
  const map: Record<string, string> = {
    Enter: "\r",
    Backspace: "\x7f",
    Tab: "\t",
    Escape: "\x1b",
    ArrowUp: "\x1b[A",
    ArrowDown: "\x1b[B",
    ArrowRight: "\x1b[C",
    ArrowLeft: "\x1b[D",
    Home: "\x1b[H",
    End: "\x1b[F",
    Delete: "\x1b[3~",
    Insert: "\x1b[2~",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
  };
  if (map[e.key]) return map[e.key];
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) return e.key;
  return null;
}

// ---------------------------------------------------------------------------
// hrtimeStart for hrtime()
// ---------------------------------------------------------------------------

const hrtimeStart = typeof performance !== "undefined" ? performance.now() : Date.now();

// ---------------------------------------------------------------------------
// Global event listeners
// ---------------------------------------------------------------------------

const globalListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

// ---------------------------------------------------------------------------
// webProcess
// ---------------------------------------------------------------------------

export const webProcess: ProcessInfo = {
  get env() {
    return _env;
  },

  cwd: () => _cwd,

  exit(code?: number): never {
    // In a browser, "exit" attempts to close the tab
    if (typeof window !== "undefined") {
      window.close();
    }
    throw new Error(`process.exit(${code ?? 0})`);
  },

  stdout: makeWritableStream("stdout"),
  stderr: makeWritableStream("stderr"),
  stdin: makeStdin(),

  platform: "browser",
  version: "v20.0.0",
  versions: { node: "20.0.0", v8: "11.0.0" },
  argv: ["node", "app"],
  pid: 1,
  ppid: 0,

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!globalListeners.has(event)) globalListeners.set(event, new Set());
    globalListeners.get(event)!.add(handler);

    if (event === "SIGINT" && typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => handler());
    }
  },

  off(event: string, handler: (...args: unknown[]) => void): void {
    globalListeners.get(event)?.delete(handler);
  },

  hrtime(time?: [number, number]): [number, number] {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = (now - hrtimeStart) * 1e6; // microseconds
    const secs = Math.floor(elapsed / 1e9);
    const nanos = Math.floor(elapsed % 1e9);
    if (time) {
      const diff = elapsed - (time[0] * 1e9 + time[1]);
      return [Math.floor(diff / 1e9), Math.floor(diff % 1e9)];
    }
    return [secs, nanos];
  },

  uptime(): number {
    return typeof performance !== "undefined"
      ? performance.now() / 1000
      : Date.now() / 1000;
  },
};
