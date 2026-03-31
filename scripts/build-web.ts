// scripts/build-web.ts
// Bundles the browser-side terminal frontend.
//
// Usage:
//   bun scripts/build-web.ts              # dev build
//   bun scripts/build-web.ts --watch      # watch mode
//   bun scripts/build-web.ts --minify     # production (minified)

import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir: string =
  (import.meta as any).dir ??
  (import.meta as any).dirname ??
  dirname(fileURLToPath(import.meta.url))

const ROOT = resolve(__dir, '..')
const ENTRY = resolve(ROOT, 'src/server/web/terminal.ts')
const OUT_DIR = resolve(ROOT, 'src/server/web/public')

const watch = process.argv.includes('--watch')
const minify = process.argv.includes('--minify')

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [ENTRY],
  bundle: true,
  platform: 'browser',
  target: ['es2020', 'chrome90', 'firefox90', 'safari14'],
  format: 'esm',
  outdir: OUT_DIR,
  // CSS imported from JS is auto-emitted alongside the JS output
  loader: { '.css': 'css' },
  minify,
  sourcemap: minify ? false : 'inline',
  tsconfig: resolve(ROOT, 'src/server/web/tsconfig.json'),
  logLevel: 'info',
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('Watching src/server/web/terminal.ts...')
  } else {
    const start = Date.now()
    const result = await esbuild.build(buildOptions)
    if (result.errors.length > 0) {
      process.exit(1)
    }
    console.log(`Web build complete in ${Date.now() - start}ms → ${OUT_DIR}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
