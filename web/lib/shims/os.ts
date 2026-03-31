/**
 * Browser shim for Node's `os` module.
 * Returns sensible defaults for the browser environment.
 */

export function platform(): string { return 'browser' }
export function arch(): string { return 'unknown' }
export function homedir(): string { return '/' }
export function tmpdir(): string { return '/tmp' }
export function hostname(): string { return 'localhost' }
export function type(): string { return 'Browser' }
export function release(): string { return '0.0.0' }
export function uptime(): number { return 0 }
export function cpus(): unknown[] { return [] }
export function totalmem(): number { return 0 }
export function freemem(): number { return 0 }
export function networkInterfaces(): Record<string, unknown[]> { return {} }
export const EOL = '\n'

export default {
  platform,
  arch,
  homedir,
  tmpdir,
  hostname,
  type,
  release,
  uptime,
  cpus,
  totalmem,
  freemem,
  networkInterfaces,
  EOL,
}
