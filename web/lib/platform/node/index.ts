/**
 * Node.js platform implementation — thin wrappers around the real built-ins.
 * Used when the code runs in Node/Bun (SSR, CLI). The shape matches Platform
 * exactly so call sites are identical to the browser shims.
 */

import nodeFs from "fs/promises";
import nodeFsSync from "fs";
import nodePath from "path";
import nodeOs from "os";
import nodeProcess from "process";
import { spawn as nodeSpawn, exec as nodeExec } from "child_process";
import type { Platform, FileSystem, Stats, Dirent, ChildProcessLike, SpawnOptions, CommandExecutor } from "../types";

// ---------------------------------------------------------------------------
// FileSystem
// ---------------------------------------------------------------------------

const fs: FileSystem = {
  readFile: nodeFs.readFile.bind(nodeFs) as FileSystem["readFile"],
  writeFile: nodeFs.writeFile.bind(nodeFs) as FileSystem["writeFile"],
  appendFile: nodeFs.appendFile.bind(nodeFs),
  readdir: (path: string) => nodeFs.readdir(path) as Promise<string[]>,

  async readdirWithTypes(path: string): Promise<Dirent[]> {
    const entries = await nodeFs.readdir(path, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isFile: () => e.isFile(),
      isDirectory: () => e.isDirectory(),
      isSymbolicLink: () => e.isSymbolicLink(),
    }));
  },

  async stat(path: string): Promise<Stats> {
    const s = await nodeFs.stat(path);
    return {
      size: s.size,
      mtime: s.mtime,
      ctime: s.ctime,
      mode: s.mode,
      isFile: () => s.isFile(),
      isDirectory: () => s.isDirectory(),
      isSymbolicLink: () => s.isSymbolicLink(),
    };
  },

  async lstat(path: string): Promise<Stats> {
    const s = await nodeFs.lstat(path);
    return {
      size: s.size,
      mtime: s.mtime,
      ctime: s.ctime,
      mode: s.mode,
      isFile: () => s.isFile(),
      isDirectory: () => s.isDirectory(),
      isSymbolicLink: () => s.isSymbolicLink(),
    };
  },

  async exists(path: string): Promise<boolean> {
    try {
      await nodeFs.access(path);
      return true;
    } catch {
      return false;
    }
  },

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await nodeFs.mkdir(path, options);
  },

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await nodeFs.rm(path, options);
  },

  unlink: nodeFs.unlink.bind(nodeFs),
  rename: nodeFs.rename.bind(nodeFs),
  copyFile: nodeFs.copyFile.bind(nodeFs),
  realpath: nodeFs.realpath.bind(nodeFs) as () => Promise<string>,
  readlink: nodeFs.readlink.bind(nodeFs) as () => Promise<string>,
  symlink: nodeFs.symlink.bind(nodeFs) as (target: string, path: string) => Promise<void>,
  chmod: nodeFs.chmod.bind(nodeFs) as (path: string, mode: number) => Promise<void>,

  watch(path: string, options: { recursive?: boolean }, listener: (event: "rename" | "change", filename: string) => void) {
    const watcher = nodeFsSync.watch(path, options, listener);
    return { close: () => watcher.close() };
  },
};

// ---------------------------------------------------------------------------
// PathUtils
// ---------------------------------------------------------------------------

const path = nodePath as unknown as Platform["path"];

// ---------------------------------------------------------------------------
// OSInfo
// ---------------------------------------------------------------------------

const os: Platform["os"] = {
  homedir: nodeOs.homedir.bind(nodeOs),
  platform: nodeOs.platform.bind(nodeOs),
  hostname: nodeOs.hostname.bind(nodeOs),
  tmpdir: nodeOs.tmpdir.bind(nodeOs),
  cpus: () =>
    nodeOs.cpus().map((c) => ({
      model: c.model,
      speed: c.speed,
      times: c.times,
    })),
  totalmem: nodeOs.totalmem.bind(nodeOs),
  freemem: nodeOs.freemem.bind(nodeOs),
  arch: nodeOs.arch.bind(nodeOs),
  release: nodeOs.release.bind(nodeOs),
  uptime: nodeOs.uptime.bind(nodeOs),
  userInfo: () => {
    const u = nodeOs.userInfo();
    return {
      username: u.username,
      uid: u.uid,
      gid: u.gid,
      homedir: u.homedir,
      shell: u.shell,
    };
  },
  networkInterfaces: () =>
    nodeOs.networkInterfaces() as Platform["os"]["networkInterfaces"] extends () => infer R ? R : never,
  EOL: nodeOs.EOL,
};

// ---------------------------------------------------------------------------
// ProcessInfo
// ---------------------------------------------------------------------------

const proc: Platform["process"] = {
  get env() {
    return nodeProcess.env as Record<string, string | undefined>;
  },
  cwd: nodeProcess.cwd.bind(nodeProcess),
  exit: nodeProcess.exit.bind(nodeProcess) as (code?: number) => never,
  stdout: nodeProcess.stdout as unknown as Platform["process"]["stdout"],
  stderr: nodeProcess.stderr as unknown as Platform["process"]["stderr"],
  stdin: nodeProcess.stdin as unknown as Platform["process"]["stdin"],
  platform: nodeProcess.platform,
  version: nodeProcess.version,
  versions: nodeProcess.versions,
  argv: nodeProcess.argv,
  pid: nodeProcess.pid,
  ppid: nodeProcess.ppid,
  on: nodeProcess.on.bind(nodeProcess) as Platform["process"]["on"],
  off: nodeProcess.off.bind(nodeProcess) as Platform["process"]["off"],
  hrtime: nodeProcess.hrtime.bind(nodeProcess) as Platform["process"]["hrtime"],
  uptime: nodeProcess.uptime.bind(nodeProcess),
};

// ---------------------------------------------------------------------------
// CommandExecutor
// ---------------------------------------------------------------------------

const exec: CommandExecutor = {
  spawn(cmd: string, args: string[], options?: SpawnOptions): ChildProcessLike {
    const child = nodeSpawn(cmd, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...nodeProcess.env, ...options.env } : undefined,
      shell: options?.shell,
      timeout: options?.timeout,
    });

    const wrapped: ChildProcessLike = {
      pid: child.pid,
      stdout: child.stdout
        ? {
            on(event: string, handler: (data: Buffer | string) => void) {
              child.stdout!.on(event, handler);
            },
          }
        : null,
      stderr: child.stderr
        ? {
            on(event: string, handler: (data: Buffer | string) => void) {
              child.stderr!.on(event, handler);
            },
          }
        : null,
      stdin: child.stdin
        ? {
            write: (data: string) => child.stdin!.write(data),
            end: () => child.stdin!.end(),
          }
        : null,
      on(event: string, handler: (...args: unknown[]) => void): typeof wrapped {
        child.on(event, handler as (...args: unknown[]) => void);
        return wrapped;
      },
      kill: (signal?: string) => child.kill(signal),
    };

    return wrapped;
  },

  exec(cmd: string, options?: SpawnOptions): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      nodeExec(
        cmd,
        {
          cwd: options?.cwd,
          env: options?.env ? { ...nodeProcess.env, ...options.env } : undefined,
          timeout: options?.timeout,
        },
        (error, stdout, stderr) => {
          if (error && !("code" in error)) {
            reject(error);
            return;
          }
          resolve({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: typeof error?.code === "number" ? error.code : 0,
          });
        }
      );
    });
  },
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export const nodePlatform: Platform = { fs, path, os, process: proc, exec };

export default nodePlatform;
