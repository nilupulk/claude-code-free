/**
 * Browser shim for Node's `path` module.
 *
 * Implements the POSIX subset of path utilities that ported components use.
 * Windows-style paths are not required in the browser context.
 */

export function join(...parts: string[]): string {
  const joined = parts.join('/')
  return normalize(joined)
}

export function resolve(...parts: string[]): string {
  let resolved = ''
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    resolved = resolved ? `${p}/${resolved}` : p
    if (p.startsWith('/')) break
  }
  return normalize(resolved || '/')
}

export function normalize(p: string): string {
  const isAbsolute = p.startsWith('/')
  const segments = p.split('/').reduce<string[]>((acc, seg) => {
    if (seg === '' || seg === '.') return acc
    if (seg === '..') {
      acc.pop()
    } else {
      acc.push(seg)
    }
    return acc
  }, [])
  return (isAbsolute ? '/' : '') + segments.join('/')
}

export function dirname(p: string): string {
  const idx = p.lastIndexOf('/')
  if (idx === -1) return '.'
  if (idx === 0) return '/'
  return p.slice(0, idx)
}

export function basename(p: string, ext?: string): string {
  const base = p.slice(p.lastIndexOf('/') + 1)
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length)
  return base
}

export function extname(p: string): string {
  const base = basename(p)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot)
}

export function relative(from: string, to: string): string {
  const fromParts = from.split('/').filter(Boolean)
  const toParts = to.split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && fromParts[i] === toParts[i]) i++
  const up = fromParts.slice(i).map(() => '..')
  return [...up, ...toParts.slice(i)].join('/') || '.'
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/')
}

export const sep = '/'
export const delimiter = ':'

export const posix = {
  join,
  resolve,
  normalize,
  dirname,
  basename,
  extname,
  relative,
  isAbsolute,
  sep,
  delimiter,
}

export default {
  join,
  resolve,
  normalize,
  dirname,
  basename,
  extname,
  relative,
  isAbsolute,
  sep,
  delimiter,
  posix,
}
