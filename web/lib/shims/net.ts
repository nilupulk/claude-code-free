/**
 * Browser shim for Node's `net` module.
 */

function notSupported(fn: string): never {
  throw new Error(`[shim] net.${fn} is not available in the browser`)
}

export class Socket {
  constructor() { notSupported('Socket') }
}
export class Server {
  constructor() { notSupported('Server') }
}
export function createServer(): never { return notSupported('createServer') }
export function connect(): never { return notSupported('connect') }
export function createConnection(): never { return notSupported('createConnection') }
export function isIP(input: string): number {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) return 4
  if (input.includes(':')) return 6
  return 0
}
export function isIPv4(input: string): boolean { return isIP(input) === 4 }
export function isIPv6(input: string): boolean { return isIP(input) === 6 }

export default { Socket, Server, createServer, connect, createConnection, isIP, isIPv4, isIPv6 }
