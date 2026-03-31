/**
 * Browser shim for Node's `fs` module.
 *
 * Code that imports `fs` but only uses it behind `if (!isWeb)` guards will
 * hit these stubs at runtime in the browser. All functions throw an
 * informative error so bugs surface immediately rather than silently.
 */

function notSupported(fn: string): never {
  throw new Error(`[shim] fs.${fn} is not available in the browser`)
}

export const readFileSync = (_path: string): never => notSupported('readFileSync')
export const writeFileSync = (_path: string, _data: unknown): never => notSupported('writeFileSync')
export const existsSync = (_path: string): boolean => false
export const mkdirSync = (_path: string, _opts?: unknown): never => notSupported('mkdirSync')
export const readdirSync = (_path: string): never => notSupported('readdirSync')
export const statSync = (_path: string): never => notSupported('statSync')
export const unlinkSync = (_path: string): never => notSupported('unlinkSync')
export const readFile = (_path: string, _cb: unknown): never => notSupported('readFile')
export const writeFile = (_path: string, _data: unknown, _cb: unknown): never => notSupported('writeFile')
export const mkdir = (_path: string, _opts: unknown, _cb: unknown): never => notSupported('mkdir')

export const promises = {
  readFile: async (_path: string): Promise<never> => notSupported('promises.readFile'),
  writeFile: async (_path: string, _data: unknown): Promise<never> => notSupported('promises.writeFile'),
  mkdir: async (_path: string, _opts?: unknown): Promise<never> => notSupported('promises.mkdir'),
  stat: async (_path: string): Promise<never> => notSupported('promises.stat'),
  readdir: async (_path: string): Promise<never> => notSupported('promises.readdir'),
  unlink: async (_path: string): Promise<never> => notSupported('promises.unlink'),
}

export const createReadStream = (_path: string): never => notSupported('createReadStream')
export const createWriteStream = (_path: string): never => notSupported('createWriteStream')

export default {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFile,
  writeFile,
  mkdir,
  promises,
  createReadStream,
  createWriteStream,
}
