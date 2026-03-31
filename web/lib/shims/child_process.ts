/**
 * Browser shim for Node's `child_process` module.
 * All APIs throw — process spawning is not available in the browser.
 */

function notSupported(fn: string): never {
  throw new Error(`[shim] child_process.${fn} is not available in the browser`)
}

export const spawn = (): never => notSupported('spawn')
export const exec = (): never => notSupported('exec')
export const execSync = (): never => notSupported('execSync')
export const execFile = (): never => notSupported('execFile')
export const fork = (): never => notSupported('fork')
export const spawnSync = (): never => notSupported('spawnSync')

export default { spawn, exec, execSync, execFile, fork, spawnSync }
