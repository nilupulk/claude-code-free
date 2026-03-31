/**
 * Browser shim for Node's `readline` module.
 */

function notSupported(fn: string): never {
  throw new Error(`[shim] readline.${fn} is not available in the browser`)
}

export function createInterface(): never { return notSupported('createInterface') }
export function clearLine(): never { return notSupported('clearLine') }
export function clearScreenDown(): never { return notSupported('clearScreenDown') }
export function cursorTo(): never { return notSupported('cursorTo') }
export function moveCursor(): never { return notSupported('moveCursor') }

export default { createInterface, clearLine, clearScreenDown, cursorTo, moveCursor }
