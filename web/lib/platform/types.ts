/**
 * Platform abstraction interfaces.
 * All Node.js-specific operations go through these interfaces so the same
 * codebase can run both in Node/Bun (CLI) and in a browser (web app).
 */

// ---------------------------------------------------------------------------
// FileSystem
// ---------------------------------------------------------------------------

export interface Stats {
  size: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  mtime: Date;
  ctime: Date;
  mode: number;
}

export interface Dirent {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface FileSystem {
  readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>;
  readFile(path: string): Promise<Buffer | Uint8Array>;
  writeFile(path: string, content: string | Uint8Array, encoding?: 'utf-8' | 'utf8'): Promise<void>;
  appendFile(path: string, data: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readdirWithTypes(path: string): Promise<Dirent[]>;
  stat(path: string): Promise<Stats>;
  lstat(path: string): Promise<Stats>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  unlink(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  realpath(path: string): Promise<string>;
  readlink(path: string): Promise<string>;
  symlink(target: string, path: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  watch(
    path: string,
    options: { recursive?: boolean },
    listener: (event: 'rename' | 'change', filename: string) => void
  ): { close(): void };
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

export interface PathUtils {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  dirname(p: string): string;
  basename(p: string, ext?: string): string;
  extname(p: string): string;
  relative(from: string, to: string): string;
  isAbsolute(p: string): boolean;
  normalize(p: string): string;
  parse(p: string): { root: string; dir: string; base: string; ext: string; name: string };
  format(obj: { root?: string; dir?: string; base?: string; ext?: string; name?: string }): string;
  sep: string;
  delimiter: string;
  posix: Omit<PathUtils, 'posix' | 'win32'>;
  win32: Omit<PathUtils, 'posix' | 'win32'>;
}

// ---------------------------------------------------------------------------
// OS
// ---------------------------------------------------------------------------

export interface CPUInfo {
  model: string;
  speed: number;
  times: { user: number; nice: number; sys: number; idle: number; irq: number };
}

export interface NetworkInterface {
  address: string;
  netmask: string;
  family: 'IPv4' | 'IPv6';
  mac: string;
  internal: boolean;
  cidr: string | null;
}

export interface OSInfo {
  homedir(): string;
  platform(): string;
  hostname(): string;
  tmpdir(): string;
  cpus(): CPUInfo[];
  totalmem(): number;
  freemem(): number;
  arch(): string;
  release(): string;
  uptime(): number;
  userInfo(): { username: string; uid: number; gid: number; homedir: string; shell: string };
  networkInterfaces(): Record<string, NetworkInterface[]>;
  EOL: string;
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

export interface WritableStreamLike {
  columns: number;
  rows: number;
  write(data: string): boolean;
  on(event: string, handler: (...args: unknown[]) => void): this;
  removeListener(event: string, handler: (...args: unknown[]) => void): this;
}

export interface ReadableStreamLike {
  on(event: string, handler: (...args: unknown[]) => void): this;
  removeListener(event: string, handler: (...args: unknown[]) => void): this;
  setRawMode?(enabled: boolean): void;
  isTTY?: boolean;
}

export interface ProcessInfo {
  env: Record<string, string | undefined>;
  cwd(): string;
  exit(code?: number): never;
  stdout: WritableStreamLike;
  stderr: WritableStreamLike;
  stdin: ReadableStreamLike;
  platform: string;
  version: string;
  versions: Record<string, string>;
  argv: string[];
  pid: number;
  ppid: number;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  hrtime(time?: [number, number]): [number, number];
  uptime(): number;
}

// ---------------------------------------------------------------------------
// Command Executor
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  timeout?: number;
}

export interface ChildProcessLike {
  pid?: number;
  stdout: { on(event: string, handler: (data: Buffer | string) => void): void } | null;
  stderr: { on(event: string, handler: (data: Buffer | string) => void): void } | null;
  stdin: { write(data: string): void; end(): void } | null;
  on(event: 'close', handler: (code: number | null) => void): this;
  on(event: 'error', handler: (err: Error) => void): this;
  on(event: string, handler: (...args: unknown[]) => void): this;
  kill(signal?: string): void;
}

export interface CommandExecutor {
  spawn(cmd: string, args: string[], options?: SpawnOptions): ChildProcessLike;
  exec(cmd: string, options?: SpawnOptions): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

// ---------------------------------------------------------------------------
// Platform aggregate
// ---------------------------------------------------------------------------

export interface Platform {
  fs: FileSystem;
  path: PathUtils;
  os: OSInfo;
  process: ProcessInfo;
  exec: CommandExecutor;
}
