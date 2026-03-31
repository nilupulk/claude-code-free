/**
 * Browser shim for Node's `worker_threads` module.
 * Web Workers are available via the native API; this shim prevents import
 * errors for code that conditionally imports worker_threads.
 */

export const isMainThread = true
export const parentPort = null
export const workerData = null
export const threadId = 0

export class Worker {
  constructor(_filename: string) {
    throw new Error('[shim] worker_threads.Worker: use the native Web Worker API in the browser')
  }
}

export function receiveMessageOnPort(_port: unknown): null { return null }
export function markAsUntransferable(_obj: unknown): void {}

export default {
  isMainThread,
  parentPort,
  workerData,
  threadId,
  Worker,
  receiveMessageOnPort,
  markAsUntransferable,
}
