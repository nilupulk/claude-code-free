import path from "path";
import fs from "fs/promises";

/** Patterns relative to project root that are always denied */
const SENSITIVE_RELATIVE_PATTERNS = [
  /^\.env(\.|$)/i,           // .env, .env.local, .env.production, etc.
  /^\.git\//,                // .git directory
  /^node_modules\//,         // node_modules (read-only allowed separately)
  /[/\\]\.env(\.|$)/i,       // .env anywhere in path
];

/** Absolute path prefixes that are always blocked */
const BLOCKED_ABSOLUTE_PREFIXES = [
  "/etc/",
  "/root/",
  "/proc/",
  "/sys/",
  "/dev/",
  "/boot/",
  "/var/run/",
];

/**
 * Validate that a user-supplied path stays within the project root.
 * Prevents path traversal attacks (../../etc/passwd etc.).
 *
 * @param userPath  - The path provided by the user (may be relative or absolute)
 * @param projectRoot - The directory the user is allowed to access
 * @returns The resolved absolute path, guaranteed to be within projectRoot
 * @throws If the path escapes the project root or targets a sensitive location
 */
export function validatePath(userPath: string, projectRoot: string): string {
  if (!userPath || typeof userPath !== "string") {
    throw new Error("Invalid path: must be a non-empty string");
  }

  const normalizedRoot = path.resolve(projectRoot);

  // Resolve: if userPath is absolute it is used as-is; if relative it's resolved from root
  const resolved = path.resolve(normalizedRoot, userPath);

  // Ensure resolved path is within project root
  const rootWithSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : normalizedRoot + path.sep;

  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error("Path traversal detected: path escapes project root");
  }

  // Check relative path against sensitive patterns
  const relativePath = path.relative(normalizedRoot, resolved);
  for (const pattern of SENSITIVE_RELATIVE_PATTERNS) {
    if (pattern.test(relativePath)) {
      throw new Error(`Access denied: path targets a restricted location`);
    }
  }

  // Check against blocked absolute prefixes
  for (const prefix of BLOCKED_ABSOLUTE_PREFIXES) {
    if (resolved.startsWith(prefix)) {
      throw new Error("Access denied: path targets a system directory");
    }
  }

  return resolved;
}

/**
 * Like validatePath but also resolves symlinks to prevent symlink escape attacks.
 * For write operations where the file may not yet exist, falls back to validatePath.
 */
export async function validatePathWithSymlinks(
  userPath: string,
  projectRoot: string
): Promise<string> {
  const validated = validatePath(userPath, projectRoot);

  try {
    const real = await fs.realpath(validated);
    // Re-validate the symlink-resolved path
    return validatePath(real, projectRoot);
  } catch {
    // File doesn't exist yet (write case) — return the pre-validated path
    return validated;
  }
}

/** Default project root: use PROJECT_ROOT env var or process.cwd() */
export function getProjectRoot(): string {
  return process.env.PROJECT_ROOT ?? process.cwd();
}
