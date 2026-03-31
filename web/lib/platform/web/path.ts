/**
 * Browser path shim — pure-JS reimplementation of Node's `path` (posix).
 * No Node.js required. Covers every method used by this codebase.
 */

import type { PathUtils } from "../types";

// ---------------------------------------------------------------------------
// Core helpers (POSIX semantics — the web always uses forward slashes)
// ---------------------------------------------------------------------------

function normalizeParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") {
        out.pop();
      } else {
        out.push("..");
      }
    } else {
      out.push(part);
    }
  }
  return out;
}

function isAbsoluteStr(p: string): boolean {
  return p.startsWith("/");
}

// ---------------------------------------------------------------------------
// posix implementation
// ---------------------------------------------------------------------------

const posixImpl: Omit<PathUtils, "posix" | "win32"> = {
  sep: "/",
  delimiter: ":",

  join(...parts: string[]): string {
    const joined = parts.filter(Boolean).join("/");
    return posixImpl.normalize(joined) || ".";
  },

  resolve(...parts: string[]): string {
    // Walk parts right-to-left; stop when we hit an absolute segment
    let resolved = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part) continue;
      resolved = resolved ? `${part}/${resolved}` : part;
      if (isAbsoluteStr(part)) break;
    }
    // If still relative, prepend fake cwd
    if (!isAbsoluteStr(resolved)) {
      const cwd =
        typeof window !== "undefined" ? window.location.pathname : "/";
      resolved = `${cwd}/${resolved}`;
    }
    return posixImpl.normalize(resolved);
  },

  normalize(p: string): string {
    if (!p) return ".";
    const absolute = isAbsoluteStr(p);
    const trailingSlash = p.endsWith("/") && p.length > 1;
    const parts = normalizeParts(p.split("/").filter(Boolean));
    let result = parts.join("/");
    if (absolute) result = "/" + result;
    if (trailingSlash && result !== "/") result += "/";
    return result || (absolute ? "/" : ".");
  },

  dirname(p: string): string {
    if (!p) return ".";
    // Strip trailing slash unless root
    const stripped = p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p;
    const idx = stripped.lastIndexOf("/");
    if (idx === -1) return ".";
    if (idx === 0) return "/";
    return stripped.slice(0, idx);
  },

  basename(p: string, ext?: string): string {
    const stripped = p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p;
    const idx = stripped.lastIndexOf("/");
    const base = idx === -1 ? stripped : stripped.slice(idx + 1);
    if (ext && base.endsWith(ext)) {
      return base.slice(0, base.length - ext.length);
    }
    return base;
  },

  extname(p: string): string {
    const base = posixImpl.basename(p);
    const dotIdx = base.lastIndexOf(".");
    if (dotIdx <= 0) return "";
    return base.slice(dotIdx);
  },

  relative(from: string, to: string): string {
    const fromParts = posixImpl.resolve(from).split("/").filter(Boolean);
    const toParts = posixImpl.resolve(to).split("/").filter(Boolean);
    let common = 0;
    while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
      common++;
    }
    const upCount = fromParts.length - common;
    const relParts = [...Array(upCount).fill(".."), ...toParts.slice(common)];
    return relParts.join("/") || ".";
  },

  isAbsolute: isAbsoluteStr,

  parse(p: string) {
    const root = isAbsoluteStr(p) ? "/" : "";
    const base = posixImpl.basename(p);
    const ext = posixImpl.extname(p);
    const name = ext ? base.slice(0, -ext.length) : base;
    const dir = posixImpl.dirname(p);
    return { root, dir, base, ext, name };
  },

  format(obj) {
    if (obj.dir) {
      return obj.dir + "/" + (obj.base ?? (obj.name ?? "") + (obj.ext ?? ""));
    }
    return (obj.root ?? "") + (obj.base ?? (obj.name ?? "") + (obj.ext ?? ""));
  },
};

// ---------------------------------------------------------------------------
// win32 implementation (minimal — the browser always uses posix paths,
// but some code imports path.win32 for platform-specific logic)
// ---------------------------------------------------------------------------

const win32Impl: Omit<PathUtils, "posix" | "win32"> = {
  sep: "\\",
  delimiter: ";",

  join(...parts: string[]): string {
    return win32Impl.normalize(parts.filter(Boolean).join("\\"));
  },

  normalize(p: string): string {
    return posixImpl.normalize(p.replace(/\\/g, "/")).replace(/\//g, "\\");
  },

  resolve(...parts: string[]): string {
    return posixImpl.resolve(...parts).replace(/\//g, "\\");
  },

  dirname(p: string): string {
    return posixImpl.dirname(p.replace(/\\/g, "/")).replace(/\//g, "\\");
  },

  basename(p: string, ext?: string): string {
    return posixImpl.basename(p.replace(/\\/g, "/"), ext);
  },

  extname(p: string): string {
    return posixImpl.extname(p.replace(/\\/g, "/"));
  },

  relative(from: string, to: string): string {
    return posixImpl
      .relative(from.replace(/\\/g, "/"), to.replace(/\\/g, "/"))
      .replace(/\//g, "\\");
  },

  isAbsolute(p: string): boolean {
    return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
  },

  parse(p: string) {
    const normalized = p.replace(/\\/g, "/");
    const result = posixImpl.parse(normalized);
    return { ...result, root: result.root ? result.root.replace(/\//g, "\\") : "" };
  },

  format(obj) {
    return posixImpl.format(obj).replace(/\//g, "\\");
  },
};

// ---------------------------------------------------------------------------
// Export: web always uses posix, but exposes win32 for cross-platform code
// ---------------------------------------------------------------------------

export const webPath: PathUtils = {
  ...posixImpl,
  posix: posixImpl,
  win32: win32Impl,
};
