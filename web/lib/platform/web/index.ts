/**
 * Web platform implementation — assembles the browser shims into a Platform.
 */

export { webFs as fs } from "./fs";
export { webPath as path } from "./path";
export { webOs as os, initOsInfo } from "./os";
export { webProcess as process, initProcessInfo } from "./process";
export { webExec as exec } from "./exec";

import { webFs } from "./fs";
import { webPath } from "./path";
import { webOs, initOsInfo } from "./os";
import { webProcess, initProcessInfo } from "./process";
import { webExec } from "./exec";
import type { Platform } from "../types";

export const webPlatform: Platform = {
  fs: webFs,
  path: webPath,
  os: webOs,
  process: webProcess,
  exec: webExec,
};

/**
 * Initialize dynamic data (env, cwd, os info) from the backend.
 * Call once before rendering the app.
 */
export async function initWebPlatform(): Promise<void> {
  await Promise.all([initOsInfo(), initProcessInfo()]);
}

export default webPlatform;
