'use client'

/**
 * WebApp — root component that boots the ported Ink application in a browser.
 *
 * Provider hierarchy (outermost → innermost):
 *   ThemeProvider       — dark/light/system theme
 *   InkCompatProvider   — satisfies useApp() / theme context for Ink components
 *   BackendProvider     — backend connection state, message queue, reconnect
 *   ConnectionStatusBanner — non-intrusive "backend unreachable" ribbon
 *   ChatLayout          — the full application UI
 *
 * Used by:
 *  - The Vite entry (web/app.tsx) when building the standalone Vite bundle
 *  - The Next.js page (web/app/page.tsx) can delegate to this for consistency
 */

import React from 'react'
import { ThemeProvider } from './lib/theme'
import { InkCompatProvider } from './lib/ink-compat'
import { BackendProvider, ConnectionStatusBanner } from './lib/BackendContext'
import { ChatLayout } from './components/chat/ChatLayout'

// ---------------------------------------------------------------------------
// Resolve backend URL
// ---------------------------------------------------------------------------

function resolveApiUrl(): string {
  // Vite exposes VITE_API_URL; Next.js exposes NEXT_PUBLIC_API_URL
  if (typeof import.meta !== 'undefined') {
    // Vite build — import.meta.env is always an object
    const viteUrl = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL
    if (viteUrl) return viteUrl
  }
  if (typeof process !== 'undefined' && process.env) {
    const nextUrl = process.env.NEXT_PUBLIC_API_URL
    if (nextUrl) return nextUrl
  }
  return 'http://localhost:3001'
}

const API_URL = resolveApiUrl()

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WebAppProps {
  /**
   * Override the backend URL. Useful in tests and Storybook.
   * Defaults to the VITE_API_URL / NEXT_PUBLIC_API_URL env variable or
   * "http://localhost:3001".
   */
  apiUrl?: string
  /**
   * Called when the Ink app calls useApp().exit().
   * In the Vite bundle this defaults to a page reload; in tests you can
   * pass a spy.
   */
  onExit?: (error?: Error) => void
}

export function WebApp({ apiUrl = API_URL, onExit }: WebAppProps) {
  const handleExit = React.useCallback(
    (error?: Error) => {
      if (onExit) {
        onExit(error)
      } else {
        // Default web behaviour: reload the page so the user gets a fresh session
        window.location.reload()
      }
    },
    [onExit],
  )

  return (
    <ThemeProvider defaultTheme="dark">
      <InkCompatProvider onExit={handleExit}>
        <BackendProvider url={apiUrl}>
          <ConnectionStatusBanner />
          <ChatLayout />
        </BackendProvider>
      </InkCompatProvider>
    </ThemeProvider>
  )
}

export default WebApp
