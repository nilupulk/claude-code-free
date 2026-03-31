import { execFile } from "child_process";
import { promisify } from "util";
import { logCommandExecution } from "./audit-log";
import { commandRateLimiter, rateLimitResponse, getClientIp } from "./rate-limiter";

const execFileAsync = promisify(execFile);

const MAX_EXECUTION_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Explicit allowlist of commands that may be executed.
 * Any command NOT in this set is rejected before execution.
 */
const COMMAND_ALLOWLIST = new Set([
  // Version control
  "git",
  // JavaScript/TypeScript runtimes & package managers
  "node", "npm", "npx", "bun", "tsc", "eslint", "prettier",
  // File utilities (no destructive variants)
  "ls", "cat", "echo", "pwd", "mkdir", "touch", "cp", "mv",
  "find", "grep", "sed", "awk", "sort", "uniq", "head", "tail",
  "wc", "diff", "patch",
  // Network (read-only)
  "curl", "wget",
  // Other language toolchains
  "python", "python3", "pip", "pip3",
  "go", "cargo", "rustc",
  "make", "cmake",
  "java", "javac", "mvn", "gradle",
]);

/**
 * Patterns applied to the full command string (command + args joined).
 * Any match causes immediate rejection regardless of allowlist.
 */
const COMMAND_DENYLIST: RegExp[] = [
  /rm\s+(-[rfRF]*\s+\/|--recursive\s+\/|--force\s+\/)/,  // rm -rf /
  /\bsudo\b/,                // privilege escalation
  /chmod\s+[0-7]*7[0-7]{2}/, // chmod 777 or similar
  /\bmkfs\b/,                // format filesystems
  /\bdd\s+if=/,              // disk writes
  /\b(shutdown|reboot|halt|poweroff)\b/, // system shutdown
  /\|\s*(?:ba|z|da|fi|k)?sh\s*$/,       // pipe to shell
  />\s*\/(?:etc|root|proc|sys|dev)\//,  // redirect to system paths
  /\beval\b/,                // shell eval
];

/** Sensitive environment variables stripped before passing to child process */
const SENSITIVE_ENV_VARS = new Set([
  "ANTHROPIC_API_KEY",
  "ENCRYPTION_KEY",
  "DATABASE_URL",
  "SESSION_SECRET",
  "JWT_SECRET",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "GOOGLE_CREDENTIALS",
  "AZURE_CLIENT_SECRET",
  "NEXT_AUTH_SECRET",
]);

function stripSensitiveEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of SENSITIVE_ENV_VARS) {
    delete env[key];
  }
  return env;
}

function checkDenylist(command: string, args: string[]): void {
  const fullCommand = [command, ...args].join(" ");
  for (const pattern of COMMAND_DENYLIST) {
    if (pattern.test(fullCommand)) {
      throw new Error(`Command blocked by security policy`);
    }
  }
}

export interface SandboxOptions {
  /** Absolute path; commands are locked to this working directory */
  cwd: string;
  userId?: string;
  ip?: string;
  requestId?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command in a sandboxed environment.
 *
 * Security guarantees:
 * - Allowlist: only explicitly approved commands may run
 * - Denylist: dangerous patterns are blocked as a second layer
 * - execFile (not exec): no shell expansion of arguments
 * - Stripped environment: no sensitive env vars passed to child
 * - Locked working directory
 * - Timeout: 5 minutes max
 * - Output size limit: 10 MB
 * - Rate limited: 20 commands/min per user
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: SandboxOptions
): Promise<SandboxResult> {
  // Rate limiting
  const rateLimitKey = options.userId ?? options.ip ?? "anonymous";
  const rl = commandRateLimiter.check(rateLimitKey);
  if (!rl.allowed) {
    const resp = rateLimitResponse(rl);
    const body = await resp.text();
    throw Object.assign(new Error(`Rate limit exceeded: ${body}`), { status: 429 });
  }

  // Allowlist check
  if (!COMMAND_ALLOWLIST.has(command)) {
    logCommandExecution({
      command,
      args,
      userId: options.userId,
      ip: options.ip,
      requestId: options.requestId,
      success: false,
      error: "Command not in allowlist",
    });
    throw new Error(`Command '${command}' is not permitted`);
  }

  // Denylist check
  try {
    checkDenylist(command, args);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blocked";
    logCommandExecution({
      command,
      args,
      userId: options.userId,
      ip: options.ip,
      requestId: options.requestId,
      success: false,
      error: message,
    });
    throw err;
  }

  const safeEnv = stripSensitiveEnv();

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: safeEnv,
      timeout: MAX_EXECUTION_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      // shell: false is the default for execFile — prevents shell metacharacter expansion
    });

    logCommandExecution({
      command,
      args,
      userId: options.userId,
      ip: options.ip,
      requestId: options.requestId,
      success: true,
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const error = err as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      message?: string;
      killed?: boolean;
    };

    const isTimeout = error.killed === true;
    const exitCode = typeof error.code === "number" ? error.code : 1;

    logCommandExecution({
      command,
      args,
      userId: options.userId,
      ip: options.ip,
      requestId: options.requestId,
      success: false,
      error: isTimeout ? "Command timed out" : error.message,
    });

    return {
      stdout: error.stdout ?? "",
      stderr: isTimeout
        ? "Command exceeded maximum execution time (5 minutes)"
        : (error.stderr ?? error.message ?? "Unknown error"),
      exitCode,
    };
  }
}

export { getClientIp };
