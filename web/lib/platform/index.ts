/**
 * Platform provider — detects the current runtime and exports the right
 * platform implementation. Import from here, not from web/ or node/ directly.
 *
 * Usage:
 *   import { platform } from '@/lib/platform'
 *   const content = await platform.fs.readFile('/path/to/file', 'utf-8')
 */

import type { Platform } from "./types";

export type { Platform };
export type {
  FileSystem,
  PathUtils,
  OSInfo,
  ProcessInfo,
  CommandExecutor,
  Stats,
  Dirent,
  ChildProcessLike,
  SpawnOptions,
  WritableStreamLike,
  ReadableStreamLike,
  CPUInfo,
  NetworkInterface,
} from "./types";

// ---------------------------------------------------------------------------
// Lazy-load the right implementation to keep bundle splits clean.
// In the browser, webpack replaces Node built-ins with shims via aliases
// configured in next.config.ts.
// ---------------------------------------------------------------------------

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// Synchronous reference — populated below (or lazily)
let _platform: Platform | null = null;

function getPlatform(): Platform {
  if (_platform) return _platform;

  if (isBrowser) {
    // Dynamic require is synchronous in webpack's browser bundle because the
    // web shims don't call any async Node APIs at module-evaluation time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./web/index") as typeof import("./web/index");
    _platform = mod.webPlatform;
  } else {
    // Node.js / server-side — use real Node built-ins wrapped in the same
    // interface shape so call sites remain identical.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./node/index") as typeof import("./node/index");
    _platform = mod.nodePlatform;
  }

  return _platform!;
}

/**
 * The active Platform. Consumers access `platform.fs`, `platform.path`, etc.
 * This is a Proxy so property access is always routed through getPlatform(),
 * which means the lazy initialisation works even in module-level code.
 */
export const platform: Platform = new Proxy({} as Platform, {
  get(_target, prop: string | symbol) {
    return (getPlatform() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Explicitly set the platform (useful for testing or SSR). */
export function setPlatform(p: Platform): void {
  _platform = p;
}

/**
 * Convenience re-exports that mirror the Node built-in API surface.
 * These are the values that webpack aliases point to, so existing code that
 * does `import fs from 'fs'` gets the browser shim automatically.
 */
export { webFs as fs } from "./web/fs";
export { webPath as path } from "./web/path";
export { webOs as os } from "./web/os";
export { webProcess as process } from "./web/process";
export { webExec as exec } from "./web/exec";
export { initWebPlatform } from "./web/index";
