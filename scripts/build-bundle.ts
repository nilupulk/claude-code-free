// scripts/build-bundle.ts
// Usage: bun scripts/build-bundle.ts [--watch] [--minify] [--no-sourcemap]
//
// Production build: bun scripts/build-bundle.ts --minify
// Dev build:        bun scripts/build-bundle.ts
// Watch mode:       bun scripts/build-bundle.ts --watch

import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { chmodSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

// Bun: import.meta.dir — Node 21+: import.meta.dirname — fallback
const __dir: string =
  (import.meta as any).dir ??
  (import.meta as any).dirname ??
  dirname(fileURLToPath(import.meta.url))

const ROOT = resolve(__dir, '..')
const watch = process.argv.includes('--watch')
const minify = process.argv.includes('--minify')
const noSourcemap = process.argv.includes('--no-sourcemap')

// Read version from package.json for MACRO injection
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))
const version = pkg.version || '0.0.0-dev'

// ── Plugin: resolve bare 'src/' imports (tsconfig baseUrl: ".") ──
// The codebase uses `import ... from 'src/foo/bar.js'` which relies on
// TypeScript's baseUrl resolution. This plugin maps those to real TS files.
const srcResolverPlugin: esbuild.Plugin = {
  name: 'src-resolver',
  setup(build) {
    build.onResolve({ filter: /^src\// }, (args) => {
      const basePath = resolve(ROOT, args.path)

      // Already exists as-is
      if (existsSync(basePath)) {
        return { path: basePath }
      }

      // Strip .js/.jsx and try TypeScript extensions
      const withoutExt = basePath.replace(/\.(js|jsx)$/, '')
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const candidate = withoutExt + ext
        if (existsSync(candidate)) {
          return { path: candidate }
        }
      }

      // Try as directory with index file
      const dirPath = basePath.replace(/\.(js|jsx)$/, '')
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const candidate = resolve(dirPath, 'index' + ext)
        if (existsSync(candidate)) {
          return { path: candidate }
        }
      }

      // File not found — return a stub so the bundle doesn't fail.
      // These are Anthropic-internal files not present in the source tree.
      return {
        path: args.path,
        namespace: 'stub-module',
      }
    })
  },
}

// ── Plugin: stub missing internal modules ──
// Many imports reference Anthropic-internal files/packages not present in the
// source tree (feature-gated code, @ant/ packages, etc.). This plugin intercepts
// unresolvable imports and returns minimal stubs so the bundle compiles.
// At runtime, feature() gates prevent these stubs from being called.
const stubMissingPlugin: esbuild.Plugin = {
  name: 'stub-missing',
  setup(build) {
    // Catch all @ant/* package imports (Anthropic-internal, not published) →
    // route them all to a single shim file that exports the needed symbols.
    const antStubPath = resolve(ROOT, 'src/shims/ant-stub.ts')
    build.onResolve({ filter: /^@ant\// }, () => ({
      path: antStubPath,
    }))

    // Handle relative imports (./ and ../) with .js extension that may map
    // to missing TypeScript source files
    build.onResolve({ filter: /^\.\.?\/.*\.(js|ts|tsx|jsx|txt|md)$/ }, (args) => {
      // Resolve the path relative to the importing file
      const importerDir = dirname(args.importer)
      const rawPath = resolve(importerDir, args.path)

      // If it already resolves to something real, let esbuild handle it normally
      if (existsSync(rawPath)) {
        return undefined
      }

      // For .js imports, try swapping to .ts / .tsx
      if (args.path.endsWith('.js') || args.path.endsWith('.jsx')) {
        const withoutExt = rawPath.replace(/\.(js|jsx)$/, '')
        for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
          const candidate = withoutExt + ext
          if (existsSync(candidate)) {
            return undefined // real file found, let esbuild resolve normally
          }
        }
        // Try as directory index
        for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
          const candidate = resolve(withoutExt, 'index' + ext)
          if (existsSync(candidate)) {
            return undefined
          }
        }
      }

      // File doesn't exist — return a stub
      const isText = args.path.endsWith('.txt') || args.path.endsWith('.md')
      const isDts = args.path.endsWith('.d.ts')
      return {
        path: args.path,
        namespace: isDts ? 'stub-empty' : isText ? 'stub-text' : 'stub-module',
        pluginData: { resolvedPath: rawPath },
      }
    })

    // Stub for TypeScript declaration files (should never be imported at runtime)
    build.onLoad({ filter: /.*/, namespace: 'stub-empty' }, () => ({
      contents: '',
      loader: 'js',
    }))

    // Stub for text/markdown files → export empty string
    build.onLoad({ filter: /.*/, namespace: 'stub-text' }, () => ({
      contents: 'export default "";',
      loader: 'js',
    }))

    // Stub for missing JS/TS modules → ESM empty object.
    // Named imports from these stubs will be undefined at runtime, which is
    // acceptable because all callers are behind feature() gates that return false
    // in external builds.
    build.onLoad({ filter: /.*/, namespace: 'stub-module' }, (args) => ({
      contents: `// Stub for missing internal module: ${args.path}\nexport default {};`,
      loader: 'js',
    }))
  },
}

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [resolve(ROOT, 'src/entrypoints/cli.tsx')],
  bundle: true,
  platform: 'node',
  target: ['node20', 'es2022'],
  format: 'esm',
  outdir: resolve(ROOT, 'dist'),
  outExtension: { '.js': '.mjs' },

  // Single-file output — no code splitting for CLI tools
  splitting: false,

  plugins: [srcResolverPlugin, stubMissingPlugin],

  // Use tsconfig for baseUrl / paths resolution (complements plugin above)
  tsconfig: resolve(ROOT, 'tsconfig.json'),

  // Alias bun:bundle to our runtime shim + stub for native addons not in this build
  alias: {
    'bun:bundle': resolve(ROOT, 'src/shims/bun-bundle.ts'),
    'color-diff-napi': resolve(ROOT, 'src/shims/color-diff-napi.ts'),
  },

  // Don't bundle node built-ins or problematic native packages
  external: [
    // Node built-ins (with and without node: prefix)
    'fs', 'path', 'os', 'crypto', 'child_process', 'http', 'https',
    'net', 'tls', 'url', 'util', 'stream', 'events', 'buffer',
    'querystring', 'readline', 'zlib', 'assert', 'tty', 'worker_threads',
    'perf_hooks', 'async_hooks', 'dns', 'dgram', 'cluster',
    'string_decoder', 'module', 'vm', 'constants', 'domain',
    'console', 'process', 'v8', 'inspector',
    'node:*',
    // Native addons that can't be bundled
    'fsevents',
    'sharp',
    'node-pty',
    'image-processor-napi',
    'audio-capture-napi',
    // 'color-diff-napi' — aliased to shim above, not external
    'modifiers-napi',
    // Anthropic-internal packages (not published externally)
    '@anthropic-ai/sandbox-runtime',
    '@anthropic-ai/claude-agent-sdk',
    '@anthropic-ai/mcpb',
    // Anthropic-internal (@ant/) packages — gated behind USER_TYPE === 'ant'
    '@ant/*',
    // AWS / Azure / GCP SDKs — optional cloud integrations
    '@anthropic-ai/bedrock-sdk',
    '@anthropic-ai/foundry-sdk',
    '@anthropic-ai/vertex-sdk',
    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-provider-node',
    '@azure/identity',
    '@smithy/core',
    '@smithy/node-http-handler',
    'google-auth-library',
    // OpenTelemetry exporters — optional observability backends
    '@opentelemetry/exporter-logs-otlp-grpc',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/exporter-logs-otlp-proto',
    '@opentelemetry/exporter-metrics-otlp-grpc',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-proto',
    '@opentelemetry/exporter-prometheus',
    '@opentelemetry/exporter-trace-otlp-grpc',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-trace-otlp-proto',
    // Other optional / missing deps
    '@alcalzone/ansi-tokenize',
    'asciichart',
    'bidi-js',
    'env-paths',
    'fflate',
    'https-proxy-agent',
    'indent-string',
    // 'jsonc-parser' — bundled (ESM build has extensionless imports that break Node)
    'lru-cache',
    'shell-quote',
    'turndown',
    'vscode-jsonrpc',
    'xss',
  ],

  jsx: 'automatic',

  // Source maps for production debugging (external .map files)
  sourcemap: noSourcemap ? false : 'external',

  // Minification for production
  minify,

  // Tree shaking (on by default, explicit for clarity)
  treeShaking: true,

  // Define replacements — inline constants at build time
  // MACRO.* — originally inlined by Bun's bundler at compile time
  // process.env.USER_TYPE — eliminates 'ant' (Anthropic-internal) code branches
  define: {
    'MACRO.VERSION': JSON.stringify(version),
    'MACRO.PACKAGE_URL': JSON.stringify('@anthropic-ai/claude-code'),
    'MACRO.ISSUES_EXPLAINER': JSON.stringify(
      'report issues at https://github.com/anthropics/claude-code/issues'
    ),
    'process.env.USER_TYPE': '"external"',
    'process.env.NODE_ENV': minify ? '"production"' : '"development"',
  },

  // Banner: shebang for direct CLI execution + explicit ESM marker so Bun
  // doesn't misclassify this file as CJS when it sees `module`/`exports`
  // references inside bundled lodash-es CJS detection code.
  banner: {
    js: '#!/usr/bin/env node\n',
  },


  // Handle the .js → .ts resolution that the codebase uses
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],

  logLevel: 'info',

  // Metafile for bundle analysis
  metafile: true,
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('Watching for changes...')
  } else {
    const startTime = Date.now()
    const result = await esbuild.build(buildOptions)

    if (result.errors.length > 0) {
      console.error('Build failed')
      process.exit(1)
    }

    // Make the output executable
    const outPath = resolve(ROOT, 'dist/cli.mjs')
    try {
      chmodSync(outPath, 0o755)
    } catch {
      // chmod may fail on some platforms, non-fatal
    }

    // Post-process: Bun 1.3.x has a heuristic that marks .mjs files as CJS
    // when it finds bare `module` or `exports` identifiers (from lodash-es's
    // UMD detection code bundled via __esm wrappers). In an ESM bundle, these
    // globals are always undefined — replace the typeof checks so Bun doesn't
    // misclassify the file and error on the static `import` declarations.
    const { readFileSync, writeFileSync: wfs } = await import('fs')
    let bundleCode = readFileSync(outPath, 'utf-8')
    bundleCode = bundleCode
      // lodash-es isBuffer.js: typeof exports == "object" → false (ESM has no exports global)
      .replace(/\btypeof exports\s*==/g, '"undefined" ==')
      // lodash-es isBuffer.js: typeof module == "object" → false (ESM has no module global)
      .replace(/\btypeof module\s*==/g, '"undefined" ==')
    wfs(outPath, bundleCode)

    // Write dist/package.json so runtimes that check package.json also see ESM.
    wfs(resolve(ROOT, 'dist/package.json'), JSON.stringify({ type: 'module' }, null, 2))

    const elapsed = Date.now() - startTime

    // Print bundle size info
    if (result.metafile) {
      const outFiles = Object.entries(result.metafile.outputs)
      for (const [file, info] of outFiles) {
        if (file.endsWith('.mjs')) {
          const sizeMB = ((info as { bytes: number }).bytes / 1024 / 1024).toFixed(2)
          console.log(`\n  ${file}: ${sizeMB} MB`)
        }
      }
      console.log(`\nBuild complete in ${elapsed}ms → dist/`)

      // Write metafile for further analysis
      const { writeFileSync } = await import('fs')
      writeFileSync(
        resolve(ROOT, 'dist/meta.json'),
        JSON.stringify(result.metafile),
      )
      console.log('  Metafile written to dist/meta.json')
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
