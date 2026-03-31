/**
 * Browser shim for Node's `tls` module.
 */

function notSupported(fn: string): never {
  throw new Error(`[shim] tls.${fn} is not available in the browser`)
}

export class TLSSocket {
  constructor() { notSupported('TLSSocket') }
}
export function connect(): never { return notSupported('connect') }
export function createServer(): never { return notSupported('createServer') }

export default { TLSSocket, connect, createServer }
