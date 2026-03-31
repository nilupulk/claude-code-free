/**
 * Browser os shim.
 * Static values are reasonable browser defaults; dynamic values (homedir, env)
 * are fetched from the backend at init time and cached.
 */

import type { OSInfo, CPUInfo, NetworkInterface } from "../types";

// ---------------------------------------------------------------------------
// Bootstrap data — populated by calling initOsInfo() at app startup
// ---------------------------------------------------------------------------

interface OsBootstrap {
  homedir: string;
  hostname: string;
  tmpdir: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  totalmem: number;
  freemem: number;
  cpus: CPUInfo[];
  username: string;
  uid: number;
  gid: number;
  shell: string;
}

let bootstrap: OsBootstrap = {
  homedir: "/home/user",
  hostname:
    typeof window !== "undefined" ? window.location.hostname : "localhost",
  tmpdir: "/tmp",
  platform: "browser",
  arch: "x64",
  release: "0.0.0",
  uptime: 0,
  totalmem: 0,
  freemem: 0,
  cpus: [
    {
      model: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      speed: 0,
      times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    },
  ],
  username: "user",
  uid: -1,
  gid: -1,
  shell: "/bin/sh",
};

let initPromise: Promise<void> | null = null;

/**
 * Fetches OS info from the backend and caches it.
 * Call once at app startup; safe to call multiple times (idempotent).
 */
export async function initOsInfo(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const base =
        typeof window !== "undefined"
          ? ""
          : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000");
      const res = await fetch(`${base}/api/env`);
      if (!res.ok) return;
      const data = await res.json();
      bootstrap = {
        ...bootstrap,
        homedir: data.homedir ?? bootstrap.homedir,
        hostname: data.hostname ?? bootstrap.hostname,
        tmpdir: data.tmpdir ?? bootstrap.tmpdir,
        platform: data.platform ?? bootstrap.platform,
        arch: data.arch ?? bootstrap.arch,
        release: data.release ?? bootstrap.release,
        uptime: data.uptime ?? bootstrap.uptime,
        totalmem: data.totalmem ?? bootstrap.totalmem,
        freemem: data.freemem ?? bootstrap.freemem,
        cpus: data.cpus ?? bootstrap.cpus,
        username: data.username ?? bootstrap.username,
        uid: data.uid ?? bootstrap.uid,
        gid: data.gid ?? bootstrap.gid,
        shell: data.shell ?? bootstrap.shell,
      };
    } catch {
      // Fall back to defaults; app continues with limited info
    }
  })();
  return initPromise;
}

// ---------------------------------------------------------------------------
// webOs implementation
// ---------------------------------------------------------------------------

export const webOs: OSInfo = {
  EOL: "\n",

  homedir: () => bootstrap.homedir,
  hostname: () => bootstrap.hostname,
  tmpdir: () => bootstrap.tmpdir,
  platform: () => bootstrap.platform,
  arch: () => bootstrap.arch,
  release: () => bootstrap.release,
  uptime: () => bootstrap.uptime,
  totalmem: () => bootstrap.totalmem,
  freemem: () => bootstrap.freemem,
  cpus: () => bootstrap.cpus,

  userInfo: () => ({
    username: bootstrap.username,
    uid: bootstrap.uid,
    gid: bootstrap.gid,
    homedir: bootstrap.homedir,
    shell: bootstrap.shell,
  }),

  networkInterfaces: (): Record<string, NetworkInterface[]> => {
    // Browsers don't expose network interfaces
    return {};
  },
};
