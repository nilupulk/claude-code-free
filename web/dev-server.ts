/**
 * web/dev-server.ts — Development server launcher
 *
 * Starts two processes in parallel:
 *   1. Vite dev server (port 4000) — serves the web app with HMR
 *   2. Backend API proxy awareness — Vite already proxies /api/* and /ws
 *      to the PTY/backend server configured in vite.config.ts.
 *
 * Usage (from the web/ directory):
 *   npx tsx dev-server.ts
 *   # or via the npm script:
 *   npm run dev:web
 *
 * Environment variables:
 *   VITE_API_URL      — backend URL (default: http://localhost:3001)
 *   VITE_PORT         — Vite dev server port (default: 4000)
 *   OPEN_BROWSER      — set to "1" to auto-open the browser (default: off)
 *
 * The script prints a summary of which ports are in use and how to connect.
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────

const VITE_PORT = parseInt(process.env.VITE_PORT ?? '4000', 10)
const BACKEND_URL = process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const OPEN_BROWSER = process.env.OPEN_BROWSER === '1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

function checkBackendReachable(url: string): Promise<boolean> {
  // Dynamic import so this file stays compatible with Node 18+
  return fetch(`${url}/api/health`, {
    signal: AbortSignal.timeout(3_000),
    cache: 'no-store',
  })
    .then((r) => r.status < 500)
    .catch(() => false)
}

function startProcess(
  label: string,
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): ChildProcess {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  })

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n[dev-server] ${label} exited with code ${code}`)
      process.exit(code)
    }
  })

  return child
}

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner(vitePort: number, backendUrl: string) {
  const line = '─'.repeat(60)
  console.log(`\n${line}`)
  console.log('  Claude Code — Web Development Server')
  console.log(line)
  console.log(`  App        →  http://localhost:${vitePort}`)
  console.log(`  Backend    →  ${backendUrl}`)
  console.log(`  HMR        →  enabled (Vite Fast Refresh)`)
  console.log(line)
  console.log('  Tip: the backend PTY server must be running separately.')
  console.log(`       Start it with: bun run src/server/web/pty-server.ts`)
  console.log(`${line}\n`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Verify the chosen Vite port is available
  const portFree = await isPortFree(VITE_PORT)
  if (!portFree) {
    console.warn(
      `[dev-server] Port ${VITE_PORT} is already in use. ` +
        `Set VITE_PORT=<port> to use a different one.`,
    )
  }

  // 2. Warn (non-fatal) if the backend is not yet reachable
  const backendOk = await checkBackendReachable(BACKEND_URL)
  if (!backendOk) {
    console.warn(
      `[dev-server] Backend at ${BACKEND_URL} is not reachable. ` +
        `The app will show a "Backend unreachable" banner until it is started.`,
    )
  }

  // 3. Print summary
  printBanner(VITE_PORT, BACKEND_URL)

  // 4. Start Vite
  const viteArgs = [
    'vite',
    '--port', String(VITE_PORT),
    '--config', path.resolve(__dirname, 'vite.config.ts'),
  ]

  if (OPEN_BROWSER) {
    viteArgs.push('--open')
  }

  const vite = startProcess(
    'Vite',
    'npx',
    viteArgs,
    __dirname,
    {
      VITE_API_URL: BACKEND_URL,
      FORCE_COLOR: '1',
    },
  )

  // 5. Forward termination signals so child processes are cleaned up
  const terminate = (signal: NodeJS.Signals) => {
    console.log(`\n[dev-server] Received ${signal} — shutting down…`)
    vite.kill(signal)
    process.exit(0)
  }

  process.on('SIGINT', () => terminate('SIGINT'))
  process.on('SIGTERM', () => terminate('SIGTERM'))
}

main().catch((err) => {
  console.error('[dev-server] Fatal error:', err)
  process.exit(1)
})
