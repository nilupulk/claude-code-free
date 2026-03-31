/**
 * Browser shim for Node's `crypto` module.
 *
 * Delegates to the Web Crypto API where possible. For Node-specific APIs
 * (createCipher, createHash etc.) that are not available natively, stubs are
 * provided that throw a clear error.
 */

// Re-export the browser's native crypto object so `import crypto from 'crypto'`
// followed by `crypto.randomUUID()` or `crypto.getRandomValues()` works.
export const webcrypto = globalThis.crypto

export function randomUUID(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  // Fallback for older browsers — RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getRandomValues<T extends ArrayBufferView>(array: T): T {
  return globalThis.crypto.getRandomValues(array)
}

function notSupported(fn: string): never {
  throw new Error(`[shim] crypto.${fn} is not available in the browser — use the Web Crypto API instead`)
}

export const createHash = (): never => notSupported('createHash')
export const createHmac = (): never => notSupported('createHmac')
export const createCipher = (): never => notSupported('createCipher')
export const createDecipher = (): never => notSupported('createDecipher')
export const createSign = (): never => notSupported('createSign')
export const createVerify = (): never => notSupported('createVerify')
export const randomBytes = (): never => notSupported('randomBytes')
export const randomInt = (): never => notSupported('randomInt')

export default {
  webcrypto,
  randomUUID,
  getRandomValues,
  createHash,
  createHmac,
  createCipher,
  createDecipher,
  createSign,
  createVerify,
  randomBytes,
  randomInt,
}
