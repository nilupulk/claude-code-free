/**
 * GET /api/env
 *
 * Returns filtered environment variables and OS info for the browser shims.
 * Sensitive keys (containing TOKEN, SECRET, KEY, PASSWORD, CREDENTIAL, PRIVATE)
 * are stripped before sending to the client.
 */
import { NextResponse } from "next/server";
import os from "os";

const SENSITIVE_PATTERN = /TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|PRIVATE|AUTH|CERT/i;

function safeEnv(): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!SENSITIVE_PATTERN.test(k) && v !== undefined) {
      safe[k] = v;
    }
  }
  return safe;
}

export async function GET() {
  const userInfo = (() => {
    try {
      return os.userInfo();
    } catch {
      return { username: "user", uid: -1, gid: -1, homedir: "/home/user", shell: "/bin/sh" };
    }
  })();

  return NextResponse.json({
    // Filtered env for process.env shim
    env: safeEnv(),

    // OS bootstrap data for os shim
    homedir: os.homedir(),
    hostname: os.hostname(),
    tmpdir: os.tmpdir(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime: os.uptime(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    cpus: os.cpus().map((c) => ({
      model: c.model,
      speed: c.speed,
      times: c.times,
    })),

    // User info
    username: userInfo.username,
    uid: userInfo.uid,
    gid: userInfo.gid,
    shell: userInfo.shell,
  });
}
