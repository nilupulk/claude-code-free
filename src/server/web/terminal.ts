/**
 * Claude Code — terminal-in-browser
 *
 * WebSocket protocol (matches src/server/web/session-manager.ts):
 *
 *  Server → client (text, JSON):
 *    { type: "session", token: string }    — new session created; token persisted in localStorage
 *    { type: "resumed", token: string }    — existing session resumed; clear terminal before replay
 *    { type: "pong" }
 *    { type: "error", message: string }
 *    { type: "exit", exitCode: number, signal: number | undefined }
 *
 *  Server → client (binary):
 *    PTY output as raw bytes (or scrollback replay on resume)
 *
 *  Server → client (text, raw):
 *    PTY output — plain string, written directly to xterm
 *
 *  Client → server (text):
 *    { type: "resize", cols: number, rows: number }
 *    { type: "ping" }
 *    raw terminal input string
 *
 *  Resume flow:
 *    1. Client reads token from localStorage and adds ?resume=TOKEN to WS URL
 *    2. Server sends { type: "resumed", token } then replays scrollback buffer as binary
 *    3. Client clears terminal and writes replayed bytes, then continues live streaming
 *    4. On PTY exit: client removes token from localStorage
 */

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

// ── Types ────────────────────────────────────────────────────────────────────

type ServerMessage =
  | { type: 'session'; token: string }
  | { type: 'resumed'; token: string }
  | { type: 'pong' }
  | { type: 'error'; message: string }
  | { type: 'exit'; exitCode: number; signal?: number }

// ── Config ───────────────────────────────────────────────────────────────────

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000
const PING_INTERVAL_MS = 5_000
const SESSION_TOKEN_KEY = 'claude-session-token'

// ── State ────────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null
let term: Terminal
let fitAddon: FitAddon
let searchAddon: SearchAddon
let reconnectDelay = RECONNECT_BASE_MS
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let lastPingSent = 0
let connected = false

// ── DOM refs ─────────────────────────────────────────────────────────────────

const loadingOverlay = document.getElementById('loading-overlay')!
const reconnectOverlay = document.getElementById('reconnect-overlay')!
const reconnectSub = document.getElementById('reconnect-sub')!
const statusDot = document.getElementById('status-dot')!
const latencyEl = document.getElementById('latency')!
const sessionBanner = document.getElementById('session-banner') as HTMLElement | null
const barBtn = document.getElementById('bar-btn') as HTMLButtonElement
const topBar = document.getElementById('top-bar')!
const toggleBarBtn = document.getElementById('toggle-bar') as HTMLButtonElement
const terminalContainer = document.getElementById('terminal-container')!

// ── Theme ────────────────────────────────────────────────────────────────────

function getTheme(): Terminal['options']['theme'] {
  const s = getComputedStyle(document.documentElement)
  const v = (prop: string) => s.getPropertyValue(prop).trim()
  return {
    background: v('--term-bg'),
    foreground: v('--term-fg'),
    cursor: v('--term-cursor'),
    selectionBackground: v('--term-selection'),
    black: v('--term-black'),
    red: v('--term-red'),
    green: v('--term-green'),
    yellow: v('--term-yellow'),
    blue: v('--term-blue'),
    magenta: v('--term-magenta'),
    cyan: v('--term-cyan'),
    white: v('--term-white'),
    brightBlack: v('--term-bright-black'),
    brightRed: v('--term-red'),
    brightGreen: v('--term-green'),
    brightYellow: v('--term-yellow'),
    brightBlue: v('--term-blue'),
    brightMagenta: v('--term-magenta'),
    brightCyan: v('--term-cyan'),
    brightWhite: v('--term-bright-white'),
  }
}

// ── Terminal initialisation ──────────────────────────────────────────────────

function initTerminal(): void {
  term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily:
      "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
    fontSize: 14,
    lineHeight: 1.2,
    theme: getTheme(),
    allowProposedApi: true,
    scrollback: 10_000,
    convertEol: true,
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  searchAddon = new SearchAddon()
  term.loadAddon(searchAddon)

  const unicode11 = new Unicode11Addon()
  term.loadAddon(unicode11)
  term.unicode.activeVersion = '11'

  term.open(terminalContainer)

  // WebGL renderer with canvas fallback
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
  } catch {
    // Canvas renderer is already active — no action needed
  }

  fitAddon.fit()

  // Keep terminal fitted to container
  const resizeObserver = new ResizeObserver(() => fitAddon.fit())
  resizeObserver.observe(terminalContainer)

  // Propagate resize to server
  term.onResize(({ cols, rows }) => sendJSON({ type: 'resize', cols, rows }))

  // Forward all terminal input to PTY
  term.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(data)
  })

  // Keyboard intercepts (return false = swallow; return true = pass through)
  term.attachCustomKeyEventHandler((ev) => {
    // Ctrl+Shift+F → in-terminal search
    if (ev.ctrlKey && ev.shiftKey && ev.key === 'F') {
      if (ev.type === 'keydown') {
        const query = window.prompt('Search terminal:')
        if (query) searchAddon.findNext(query, { caseSensitive: false, regex: false })
      }
      return false
    }
    // Ctrl+Shift+C → copy selection (Linux convention)
    if (ev.ctrlKey && ev.shiftKey && ev.key === 'C') {
      if (ev.type === 'keydown') {
        const sel = term.getSelection()
        if (sel) navigator.clipboard.writeText(sel)
      }
      return false
    }
    // Ctrl+Shift+V → paste (Linux convention)
    if (ev.ctrlKey && ev.shiftKey && ev.key === 'V') {
      if (ev.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(text)
        })
      }
      return false
    }
    return true
  })

  // Update theme when OS preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    term.options.theme = getTheme()
  })
}

// ── WebSocket ────────────────────────────────────────────────────────────────

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = new URL(`${proto}//${location.host}/ws`)

  // Auth token: URL param wins, then localStorage
  const params = new URLSearchParams(location.search)
  const token = params.get('token') ?? localStorage.getItem('claude-terminal-token')
  if (token) {
    url.searchParams.set('token', token)
    localStorage.setItem('claude-terminal-token', token)
  }

  // Pass current terminal dimensions so the PTY is spawned/resized at the right size
  url.searchParams.set('cols', String(term.cols))
  url.searchParams.set('rows', String(term.rows))

  // Session resume token — if present the server will reattach to the existing PTY
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY)
  if (sessionToken) {
    url.searchParams.set('resume', sessionToken)
  }

  return url.toString()
}

function sendJSON(msg: Record<string, unknown>): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function connect(): void {
  setStatus('connecting')

  ws = new WebSocket(getWsUrl())

  ws.addEventListener('open', () => {
    connected = true
    reconnectDelay = RECONNECT_BASE_MS
    setStatus('connected')
    hideOverlay(loadingOverlay)
    hideOverlay(reconnectOverlay)
    // Re-sync size in case the window changed while connecting
    fitAddon.fit()
    sendJSON({ type: 'resize', cols: term.cols, rows: term.rows })
    startPing()
  })

  ws.addEventListener('message', ({ data }: MessageEvent<string | ArrayBuffer>) => {
    if (data instanceof ArrayBuffer) {
      // Binary frame: raw PTY bytes or scrollback replay
      term.write(new Uint8Array(data))
      return
    }
    // Text frame: try JSON control message first, then raw PTY output
    if (data.startsWith('{')) {
      try {
        handleControlMessage(JSON.parse(data) as ServerMessage)
        return
      } catch {
        // Not JSON — fall through to write as PTY output
      }
    }
    term.write(data)
  })

  ws.addEventListener('close', onDisconnect)
  ws.addEventListener('error', () => {
    // 'error' always fires before 'close'; let onDisconnect handle reconnect
  })
}

function handleControlMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'session':
      // New session created — store the token so we can resume on reconnect
      localStorage.setItem(SESSION_TOKEN_KEY, msg.token)
      term.clear()
      showSessionBanner('New session')
      break

    case 'resumed':
      // Existing PTY reattached — clear the terminal before scrollback replay bytes arrive
      localStorage.setItem(SESSION_TOKEN_KEY, msg.token)
      term.clear()
      showSessionBanner('Resumed session')
      break

    case 'pong':
      latencyEl.textContent = `${Date.now() - lastPingSent}ms`
      break

    case 'error':
      // Discard a stale token if the server reports an error (session may be gone)
      localStorage.removeItem(SESSION_TOKEN_KEY)
      term.writeln(`\r\n\x1b[31m[error] ${msg.message}\x1b[0m`)
      break

    case 'exit':
      // PTY exited — clear the token so the next connection starts fresh
      localStorage.removeItem(SESSION_TOKEN_KEY)
      term.writeln(
        `\r\n\x1b[33m[session ended — exit code ${msg.exitCode ?? 0}]\x1b[0m`,
      )
      break
  }
}

// ── Session banner ────────────────────────────────────────────────────────────

let bannerTimer: ReturnType<typeof setTimeout> | null = null

function showSessionBanner(text: string): void {
  if (!sessionBanner) return
  sessionBanner.textContent = text
  sessionBanner.classList.add('visible')
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    sessionBanner.classList.remove('visible')
    bannerTimer = null
  }, 3_000)
}

function onDisconnect(): void {
  connected = false
  ws = null
  setStatus('disconnected')
  stopPing()
  showOverlay(reconnectOverlay)
  scheduleReconnect()
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectSub.textContent = `Retrying in ${Math.round(reconnectDelay / 1_000)}s…`
  reconnectTimer = setTimeout(() => connect(), reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
}

function manualReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectDelay = RECONNECT_BASE_MS
  ws?.close()
  ws = null
  // Terminal is cleared by handleControlMessage when the server responds
  // with { type: "session" } or { type: "resumed" }
  connect()
}

// ── Ping / latency ───────────────────────────────────────────────────────────

function startPing(): void {
  stopPing()
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      lastPingSent = Date.now()
      sendJSON({ type: 'ping' })
    }
  }, PING_INTERVAL_MS)
}

function stopPing(): void {
  if (pingTimer) clearInterval(pingTimer)
  pingTimer = null
  latencyEl.textContent = '--'
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setStatus(state: 'connected' | 'connecting' | 'disconnected'): void {
  statusDot.className = 'status-dot'
  if (state !== 'connected') statusDot.classList.add(state)
  barBtn.textContent = connected ? 'Disconnect' : 'Reconnect'
}

function showOverlay(el: HTMLElement): void {
  el.classList.remove('hidden')
  el.classList.add('visible')
}

function hideOverlay(el: HTMLElement): void {
  el.classList.remove('visible')
  el.classList.add('hidden')
}

// ── Top bar collapse ──────────────────────────────────────────────────────────

function setupBarToggle(): void {
  const STORAGE_KEY = 'claude-bar-collapsed'

  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    topBar.classList.add('collapsed')
  }

  // Show bar button re-expands it
  toggleBarBtn.addEventListener('click', () => {
    topBar.classList.remove('collapsed')
    localStorage.setItem(STORAGE_KEY, 'false')
    setTimeout(() => fitAddon.fit(), 200)
  })

  // Double-click bar to collapse
  topBar.addEventListener('dblclick', () => {
    topBar.classList.add('collapsed')
    localStorage.setItem(STORAGE_KEY, 'true')
    setTimeout(() => fitAddon.fit(), 200)
  })

  barBtn.addEventListener('click', () => {
    if (connected) {
      ws?.close()
    } else {
      manualReconnect()
    }
  })
}

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTerminal()
  setupBarToggle()
  connect()

  // Keep terminal focused
  document.addEventListener('click', () => term.focus())
  term.focus()
})
