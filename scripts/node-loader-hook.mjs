// scripts/node-loader-hook.mjs
// Node.js ESM loader hook — fixes module resolution issues for running under
// Node.js / tsx without Bun.
//
// Handles:
//   1. bun:bundle  → local shim (src/shims/bun-bundle.mjs)
//   2. jsonc-parser/lib/esm/main.js → UMD version (ESM version has extensionless imports that break Node.js)

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'bun:bundle') {
    const shimPath = resolvePath(__dirname, '../src/shims/bun-bundle.mjs')
    return { url: pathToFileURL(shimPath).href, shortCircuit: true }
  }

  // jsonc-parser's ESM build uses extensionless imports that break Node.js strict ESM.
  // Redirect to the UMD build which is plain CJS and works fine.
  if (specifier === 'jsonc-parser/lib/esm/main.js') {
    const umdPath = resolvePath(__dirname, '../node_modules/jsonc-parser/lib/umd/main.js')
    return { url: pathToFileURL(umdPath).href, shortCircuit: true }
  }

  // Resolve first, then check if we landed on an ESM build that has extensionless imports.
  // If so, redirect to the CJS/src build which Node.js can handle.
  const resolved = await nextResolve(specifier, context)
  const url = resolved.url

  // Pattern: .../build/esm/index.js → .../build/src/index.js
  if (url && url.includes('/build/esm/') && url.endsWith('index.js')) {
    const cjsUrl = url.replace('/build/esm/', '/build/src/')
    try {
      const cjsPath = fileURLToPath(cjsUrl)
      const { existsSync } = await import('node:fs')
      if (existsSync(cjsPath)) {
        return { url: cjsUrl, shortCircuit: true }
      }
    } catch {
      // Fall through to return original resolved
    }
  }

  return resolved
}
