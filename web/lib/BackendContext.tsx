'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

interface QueuedItem<T = unknown> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

export interface InitialState {
  cwd: string
  env: Record<string, string>
  version?: string
}

export interface BackendContextValue {
  /** Current connection status */
  status: ConnectionStatus
  /** Backend base URL */
  url: string
  /** Initial state fetched on first successful connection */
  initialState: InitialState | null
  /**
   * Enqueue a request. If the backend is connected the request runs
   * immediately; otherwise it is queued and replayed on reconnect.
   */
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>
  /** Trigger an immediate reconnect attempt (resets backoff). */
  reconnect: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BackendContext = createContext<BackendContextValue | null>(null)
BackendContext.displayName = 'BackendContext'

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('useBackend must be used within a <BackendProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEALTH_CHECK_INTERVAL_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const HEALTH_TIMEOUT_MS = 5_000

// Endpoints to try for health checking, in order
const HEALTH_PATHS = ['/api/health', '/api/status', '/api/chat']

// ---------------------------------------------------------------------------
// BackendProvider
// ---------------------------------------------------------------------------

export interface BackendProviderProps {
  children: React.ReactNode
  /** Base URL of the backend API (e.g. "http://localhost:3001") */
  url: string
}

export function BackendProvider({ children, url }: BackendProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [initialState, setInitialState] = useState<InitialState | null>(null)

  // Queue of requests waiting for a live connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queueRef = useRef<QueuedItem<any>[]>([])

  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>()
  const mountedRef = useRef(true)

  // ---------------------------------------------------------------------------
  // Flush queued requests after successful reconnect
  // ---------------------------------------------------------------------------

  const flushQueue = useCallback(() => {
    const pending = queueRef.current.splice(0)
    for (const item of pending) {
      item.fn().then(item.resolve).catch(item.reject)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Health check — tries known endpoints and resolves the backend URL
  // ---------------------------------------------------------------------------

  const checkHealth = useCallback(async (): Promise<boolean> => {
    for (const path of HEALTH_PATHS) {
      try {
        const res = await fetch(`${url}${path}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
          cache: 'no-store',
        })
        // Any non-5xx response means the server is up
        if (res.status < 500) return true
      } catch {
        // Try next path
      }
    }
    return false
  }, [url])

  // ---------------------------------------------------------------------------
  // Fetch initial state from the backend (cwd, filtered env, etc.)
  // ---------------------------------------------------------------------------

  const fetchInitialState = useCallback(async (): Promise<void> => {
    // Try the session endpoint; fall back to a minimal default so the app
    // still boots even when the endpoint doesn't exist yet.
    try {
      const res = await fetch(`${url}/api/session`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as Partial<InitialState>
        setInitialState({
          cwd: data.cwd ?? '/',
          env: data.env ?? {},
          version: data.version,
        })
        return
      }
    } catch {
      // Backend doesn't expose /api/session yet — use minimal defaults
    }
    setInitialState({ cwd: '/', env: {} })
  }, [url])

  // ---------------------------------------------------------------------------
  // Core connect / reconnect loop
  // ---------------------------------------------------------------------------

  const connect = useCallback(async () => {
    if (!mountedRef.current) return
    setStatus('connecting')

    const alive = await checkHealth()

    if (!mountedRef.current) return

    if (alive) {
      attemptsRef.current = 0
      setStatus('connected')

      if (!initialState) {
        await fetchInitialState()
      }

      flushQueue()

      // Schedule periodic health checks
      clearInterval(healthIntervalRef.current)
      healthIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) return
        const still = await checkHealth()
        if (!still && mountedRef.current) {
          clearInterval(healthIntervalRef.current)
          setStatus('disconnected')
          scheduleReconnect()
        }
      }, HEALTH_CHECK_INTERVAL_MS)
    } else {
      scheduleReconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkHealth, fetchInitialState, flushQueue, initialState])

  function scheduleReconnect() {
    if (!mountedRef.current) return
    setStatus('disconnected')

    const delay = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, attemptsRef.current),
      MAX_BACKOFF_MS,
    )
    attemptsRef.current += 1

    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect()
    }, delay)
  }

  // ---------------------------------------------------------------------------
  // Mount / unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      clearInterval(healthIntervalRef.current)
    }
  // Only run on mount; `connect` is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ---------------------------------------------------------------------------
  // Public reconnect trigger (resets backoff)
  // ---------------------------------------------------------------------------

  const reconnect = useCallback(() => {
    attemptsRef.current = 0
    clearTimeout(reconnectTimerRef.current)
    clearInterval(healthIntervalRef.current)
    connect()
  }, [connect])

  // ---------------------------------------------------------------------------
  // Enqueue helper
  // ---------------------------------------------------------------------------

  const enqueue = useCallback(
    <T,>(fn: () => Promise<T>): Promise<T> => {
      if (status === 'connected') {
        return fn()
      }
      return new Promise<T>((resolve, reject) => {
        queueRef.current.push({ fn, resolve, reject } as QueuedItem<T>)
      })
    },
    [status],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const value: BackendContextValue = {
    status,
    url,
    initialState,
    enqueue,
    reconnect,
  }

  return (
    <BackendContext.Provider value={value}>
      {children}
    </BackendContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Connection status banner (shown when disconnected / errored)
// ---------------------------------------------------------------------------

/**
 * Renders a non-intrusive status indicator at the top of the viewport when
 * the backend is not reachable. Drop this anywhere inside a <BackendProvider>.
 */
export function ConnectionStatusBanner() {
  const { status, reconnect } = useBackend()

  if (status === 'connected' || status === 'connecting') return null

  const label =
    status === 'disconnected'
      ? 'Backend unreachable — retrying…'
      : 'Connection error'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.5rem 1rem',
        background: status === 'error' ? '#7f1d1d' : '#1c1917',
        borderBottom: '1px solid',
        borderColor: status === 'error' ? '#ef4444' : '#44403c',
        color: '#f5f5f4',
        fontSize: '0.8125rem',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f59e0b',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      {label}
      <button
        onClick={reconnect}
        style={{
          marginLeft: '0.5rem',
          padding: '0.125rem 0.625rem',
          border: '1px solid #57534e',
          borderRadius: 4,
          background: 'transparent',
          color: '#d6d3d1',
          fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Retry now
      </button>
    </div>
  )
}
