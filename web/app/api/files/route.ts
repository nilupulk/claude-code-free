import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import type { Dirent } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Project root to expose — default to cwd (the repo root when running in dev)
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();

// Files/dirs to always hide regardless of .gitignore
const ALWAYS_HIDDEN = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  ".cache",
  "__pycache__",
  ".DS_Store",
  "Thumbs.db",
]);

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  gitStatus?: string | null;
}

/** Run `git status --porcelain` and return a map of relative path → status char */
async function getGitStatus(root: string): Promise<Map<string, string>> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain", "-u"], {
      cwd: root,
      timeout: 5000,
    });
    const map = new Map<string, string>();
    for (const line of stdout.split("\n")) {
      if (!line) continue;
      // Format: XY path  (XY are two status chars, then space, then path)
      const xy = line.slice(0, 2).trim();
      const filePath = line.slice(3).trim().replace(/^"(.*)"$/, "$1"); // unquote if needed
      if (xy && filePath) {
        // Use index status char; fall back to working-tree char
        const status = xy[0] !== " " && xy[0] !== "?" ? xy[0] : xy[1] !== " " ? xy[1] : "?";
        map.set(filePath, status === "?" ? "?" : status);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Read ignored paths from .gitignore (basic, non-recursive) */
async function getIgnoredPatterns(root: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(root, ".gitignore"), "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

/** Minimal gitignore-style pattern match for a single path segment */
function matchesIgnore(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Strip leading slash
    const p = pattern.startsWith("/") ? pattern.slice(1) : pattern;
    // Simple glob: ends with /* or exact match or starts with the name
    if (p === name) return true;
    if (p.endsWith("/") && p.slice(0, -1) === name) return true;
    if (p.includes("*")) {
      const regex = new RegExp("^" + p.replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$");
      if (regex.test(name)) return true;
    }
  }
  return false;
}

async function buildTree(
  dirPath: string,
  rootPath: string,
  gitStatusMap: Map<string, string>,
  ignorePatterns: string[],
  showIgnored: boolean,
  depth = 0
): Promise<FileNode[]> {
  if (depth > 8) return []; // safety limit

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (ALWAYS_HIDDEN.has(entry.name)) continue;
    if (!showIgnored && matchesIgnore(entry.name, ignorePatterns)) continue;
    // Hide dotfiles unless explicitly shown
    if (!showIgnored && entry.name.startsWith(".") && entry.name !== ".env.example") continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);
    const gitStatus = gitStatusMap.get(relativePath) ?? null;

    if (entry.isDirectory()) {
      const children = await buildTree(
        fullPath,
        rootPath,
        gitStatusMap,
        ignorePatterns,
        showIgnored,
        depth + 1
      );
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
        children,
        gitStatus,
      });
    } else if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "file",
        gitStatus,
      });
    }
  }

  // Directories first, then files; both sorted alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const showIgnored = searchParams.get("showIgnored") === "true";

  // Security: ensure we're only serving files within PROJECT_ROOT
  const resolvedRoot = path.resolve(PROJECT_ROOT);

  const [gitStatusMap, ignorePatterns] = await Promise.all([
    getGitStatus(resolvedRoot),
    getIgnoredPatterns(resolvedRoot),
  ]);

  const tree = await buildTree(
    resolvedRoot,
    resolvedRoot,
    gitStatusMap,
    ignorePatterns,
    showIgnored
  );

  // Build breadcrumbs from the root path
  const parts = resolvedRoot.split(path.sep).filter(Boolean);
  const breadcrumbs = parts.slice(-3); // show last 3 segments

  return NextResponse.json({
    tree,
    root: resolvedRoot,
    breadcrumbs,
  });
}
