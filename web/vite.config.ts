import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite configuration for the standalone web build.
 *
 * This is an alternative to the Next.js build. Use it when you want:
 *   - A lighter dev server without SSR overhead
 *   - Pure client-side rendering that mirrors the terminal app's output
 *   - Easy side-by-side comparison with `claude` running in the terminal
 *
 * Scripts (added to web/package.json):
 *   npm run dev:web    — Vite dev server (port 4000) + backend proxy
 *   npm run build:web  — Production bundle → web/dist/
 *   npm run preview:web — Preview the production bundle locally
 */
export default defineConfig(({ mode }) => {
  // Load .env / .env.local variables so they are available in the config
  const env = loadEnv(mode, process.cwd(), '')

  const backendUrl = env.VITE_API_URL ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  return {
    // ── Build entry ───────────────────────────────────────────────────────
    root: __dirname,
    publicDir: path.resolve(__dirname, 'public'),

    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      sourcemap: mode === 'development' || mode === 'staging',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          // Separate vendor chunks to improve caching
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              'framer-motion',
              'lucide-react',
            ],
            'editor-vendor': [
              'codemirror',
              '@codemirror/state',
              '@codemirror/view',
              '@codemirror/commands',
            ],
          },
        },
      },
      // Tree-shake unused Node.js code paths that crept in via imports
      target: 'es2020',
    },

    // ── Plugins ───────────────────────────────────────────────────────────
    plugins: [
      react({
        // babel options — Fast Refresh is on by default in dev mode
        babel: {
          plugins: [],
        },
      }),
    ],

    // ── Module resolution ─────────────────────────────────────────────────
    resolve: {
      alias: {
        // Path alias so web components can use "@/..." imports
        '@': path.resolve(__dirname),

        // ── Ink compatibility layer ──────────────────────────────────────
        // Any `import ... from 'ink'` in the ported src/components/** is
        // rewritten to our browser-native compat layer. This is the same
        // alias that next.config.ts sets up for the webpack/Next.js path.
        ink: path.resolve(__dirname, 'lib/ink-compat/index.ts'),

        // ── Node.js built-in shims ───────────────────────────────────────
        // These stubs replace modules that Vite would otherwise fail to
        // resolve because they do not exist in the browser.
        fs: path.resolve(__dirname, 'lib/shims/fs.ts'),
        path: path.resolve(__dirname, 'lib/shims/path.ts'),
        os: path.resolve(__dirname, 'lib/shims/os.ts'),
        child_process: path.resolve(__dirname, 'lib/shims/child_process.ts'),
        worker_threads: path.resolve(__dirname, 'lib/shims/worker_threads.ts'),
        readline: path.resolve(__dirname, 'lib/shims/readline.ts'),
        net: path.resolve(__dirname, 'lib/shims/net.ts'),
        tls: path.resolve(__dirname, 'lib/shims/tls.ts'),
        crypto: path.resolve(__dirname, 'lib/shims/crypto.ts'),
      },
    },

    // ── Define global constants ───────────────────────────────────────────
    define: {
      // Expose a shim so code that reads `process.env.XYZ` doesn't crash.
      // Vite replaces these at bundle time — they are NOT dynamic.
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(backendUrl),
      // Prevent `typeof process !== 'undefined'` guards from being elided
      'process.env': JSON.stringify({
        NODE_ENV: mode,
        NEXT_PUBLIC_API_URL: backendUrl,
      }),
    },

    // ── Dev server ────────────────────────────────────────────────────────
    server: {
      port: 4000,
      strictPort: false,
      open: false,

      proxy: {
        // Forward /api/* to the backend so fetch('/api/chat') works without
        // CORS issues during development.
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (p) => p, // keep the path as-is
        },
        // Forward WebSocket connections used by the PTY server
        '/ws': {
          target: backendUrl.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },

    // ── Preview server (vite preview) ─────────────────────────────────────
    preview: {
      port: 4001,
      strictPort: false,
    },

    // ── Optimise deps ─────────────────────────────────────────────────────
    optimizeDeps: {
      // Pre-bundle these so Vite doesn't have to transform them on every
      // cold request during development.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'zustand',
        'nanoid',
        'framer-motion',
        'lucide-react',
      ],
      // Exclude packages that use native Node.js APIs — the shims handle them.
      exclude: ['node-pty', 'ws'],
    },
  }
})
