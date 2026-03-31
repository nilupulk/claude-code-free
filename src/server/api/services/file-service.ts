/**
 * File service — safe wrappers around the local file system.
 *
 * All paths are resolved relative to WORK_DIR (default: process.cwd()).
 * Paths are validated so they cannot escape the root.
 */

import {
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  mkdirSync,
} from "fs";
import { resolve, relative, join, dirname } from "path";
import { execSync } from "child_process";
import { ApiError } from "../middleware/error-handler.js";

const WORK_DIR = resolve(process.env.WORK_DIR ?? process.cwd());

// ── Path safety ───────────────────────────────────────────────────────────────

function safePath(rawPath: string): string {
  const abs = resolve(rawPath);
  const rel = relative(WORK_DIR, abs);
  // Reject paths that escape WORK_DIR (start with "../" or are absolute outside)
  if (rel.startsWith("..") || (abs !== WORK_DIR && !abs.startsWith(WORK_DIR + "/"))) {
    throw ApiError.forbidden(`Path outside allowed root: ${rawPath}`);
  }
  return abs;
}

// ── File stat ─────────────────────────────────────────────────────────────────

export interface FileStat {
  path: string;
  name: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  modified: number;
  created: number;
}

export function statFile(rawPath: string): FileStat {
  const abs = safePath(rawPath);
  try {
    const st = statSync(abs);
    return {
      path: abs,
      name: abs.split("/").pop() ?? "",
      type: st.isDirectory() ? "directory" : st.isSymbolicLink() ? "symlink" : st.isFile() ? "file" : "other",
      size: st.size,
      modified: st.mtimeMs,
      created: st.birthtimeMs,
    };
  } catch {
    throw ApiError.notFound(`File: ${rawPath}`);
  }
}

// ── List directory ────────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: number;
}

export function listDirectory(rawPath: string): FileNode[] {
  const abs = safePath(rawPath);
  try {
    const entries = readdirSync(abs, { withFileTypes: true });
    return entries.map((e) => {
      const fullPath = join(abs, e.name);
      let size: number | undefined;
      let modified: number | undefined;
      try {
        const st = statSync(fullPath);
        size = st.size;
        modified = st.mtimeMs;
      } catch {
        // ignore
      }
      return {
        name: e.name,
        path: fullPath,
        type: e.isDirectory() ? "directory" : "file",
        size,
        modified,
      };
    });
  } catch {
    throw ApiError.notFound(`Directory: ${rawPath}`);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

const MAX_READ_BYTES = 5 * 1024 * 1024; // 5 MB

export function readFile(rawPath: string, limit?: number, offset?: number): { content: string; truncated: boolean } {
  const abs = safePath(rawPath);
  let raw: string;
  try {
    raw = readFileSync(abs, "utf-8");
  } catch {
    throw ApiError.notFound(`File: ${rawPath}`);
  }

  if (raw.length > MAX_READ_BYTES) {
    return { content: raw.slice(0, MAX_READ_BYTES), truncated: true };
  }

  if (limit !== undefined || offset !== undefined) {
    const lines = raw.split("\n");
    const start = offset ?? 0;
    const end = limit !== undefined ? start + limit : lines.length;
    return { content: lines.slice(start, end).join("\n"), truncated: end < lines.length };
  }

  return { content: raw, truncated: false };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function writeFile(rawPath: string, content: string): void {
  const abs = safePath(rawPath);
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
  } catch (err) {
    throw new ApiError(500, "WRITE_ERROR", `Failed to write file: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Search (grep) ─────────────────────────────────────────────────────────────

export function grepFiles(query: string, searchPath?: string, globPattern?: string): string {
  const dir = safePath(searchPath ?? WORK_DIR);
  const args: string[] = ["-r", "--line-number", "--max-count=100"];

  if (globPattern) args.push(`--glob=${globPattern}`);
  args.push("--", query, dir);

  try {
    return execSync(`rg ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`, {
      encoding: "utf-8",
      maxBuffer: 2 * 1024 * 1024,
      timeout: 10_000,
    });
  } catch (err: unknown) {
    // rg exits with 1 when no matches — that's not an error
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 1) return "";
    if (err && typeof err === "object" && "stdout" in err && typeof (err as { stdout: unknown }).stdout === "string") {
      return (err as { stdout: string }).stdout;
    }
    return "";
  }
}

// ── Find (glob) ───────────────────────────────────────────────────────────────

export function globFiles(pattern: string, searchPath?: string): string[] {
  const dir = safePath(searchPath ?? WORK_DIR);
  try {
    const out = execSync(
      `find '${dir}' -path '${join(dir, pattern).replace(/'/g, "'\\''")}' -not -path '*/node_modules/*' -not -path '*/.git/*'`,
      { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024, timeout: 10_000 },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ── Export as FileService class (for DI into ClaudeService) ──────────────────

export class FileService {
  read = readFile;
  write = writeFile;
  stat = statFile;
  list = listDirectory;
  grep = grepFiles;
  glob = globFiles;
}
