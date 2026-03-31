'use client'

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react'

// ---------------------------------------------------------------------------
// WebAppContext  (mirrors Ink's AppContext)
// ---------------------------------------------------------------------------

export type WebAppContextValue = {
  /**
   * Call to "exit" the app.  On the web this calls the optional `onExit`
   * callback passed to `<InkCompatProvider onExit={...}>`.
   */
  readonly exit: (error?: Error) => void
}

export const WebAppContext = createContext<WebAppContextValue>({
  exit() {},
})
WebAppContext.displayName = 'WebAppContext'

// ---------------------------------------------------------------------------
// WebThemeContext  (minimal theme key → CSS color resolver)
// ---------------------------------------------------------------------------

/**
 * A minimal colour palette that mirrors the dark-mode Anthropic theme used
 * by Claude Code's design-system components.  Components that call
 * `useTheme()` or resolve theme keys via `ThemedBox` / `ThemedText` will get
 * these values when rendered in a browser.
 *
 * Override the entire palette by passing a `theme` prop to
 * `<InkCompatProvider>`.
 */
export type WebTheme = Record<string, string>

export const DEFAULT_WEB_THEME: WebTheme = {
  // Core brand
  claude: '#d97706',
  claudeShimmer: '#f59e0b',
  claudeBlue_FOR_SYSTEM_SPINNER: '#3b82f6',
  claudeBlueShimmer_FOR_SYSTEM_SPINNER: '#60a5fa',
  // Semantic
  permission: '#8b5cf6',
  permissionShimmer: '#a78bfa',
  planMode: '#f59e0b',
  ide: '#10b981',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  warningShimmer: '#fcd34d',
  merged: '#8b5cf6',
  // Text & UI
  text: '#f8fafc',
  inverseText: '#0f172a',
  inactive: '#64748b',
  inactiveShimmer: '#94a3b8',
  subtle: '#475569',
  suggestion: '#60a5fa',
  remember: '#a78bfa',
  background: '#0f172a',
  promptBorder: '#334155',
  promptBorderShimmer: '#475569',
  bashBorder: '#1e293b',
  autoAccept: '#22c55e',
  // Diff
  diffAdded: '#166534',
  diffRemoved: '#7f1d1d',
  diffAddedDimmed: '#14532d',
  diffRemovedDimmed: '#450a0a',
  diffAddedWord: '#bbf7d0',
  diffRemovedWord: '#fecaca',
  // Agent colors
  red_FOR_SUBAGENTS_ONLY: '#ef4444',
  blue_FOR_SUBAGENTS_ONLY: '#3b82f6',
  green_FOR_SUBAGENTS_ONLY: '#22c55e',
  yellow_FOR_SUBAGENTS_ONLY: '#eab308',
  purple_FOR_SUBAGENTS_ONLY: '#8b5cf6',
  orange_FOR_SUBAGENTS_ONLY: '#f97316',
  pink_FOR_SUBAGENTS_ONLY: '#ec4899',
  cyan_FOR_SUBAGENTS_ONLY: '#06b6d4',
  // Grove / Chrome
  professionalBlue: '#2563eb',
  chromeYellow: '#fbbf24',
  // TUI V2
  clawd_body: '#f8fafc',
  clawd_background: '#0f172a',
  userMessageBackground: '#1e293b',
  userMessageBackgroundHover: '#293548',
  messageActionsBackground: '#1e3a5f',
  selectionBg: '#1d4ed8',
  bashMessageBackgroundColor: '#1e293b',
  memoryBackgroundColor: '#1e293b',
  // Rate-limit
  rate_limit_fill: '#3b82f6',
  rate_limit_empty: '#1e293b',
  // Fast mode
  fastMode: '#f59e0b',
  fastModeShimmer: '#fcd34d',
  // Brief/assistant mode labels
  briefLabelYou: '#94a3b8',
  briefLabelClaude: '#d97706',
  // Rainbow
  rainbow_red: '#ef4444',
  rainbow_orange: '#f97316',
  rainbow_yellow: '#eab308',
  rainbow_green: '#22c55e',
  rainbow_blue: '#3b82f6',
  rainbow_indigo: '#6366f1',
  rainbow_violet: '#8b5cf6',
}

export const WebThemeContext = createContext<WebTheme>(DEFAULT_WEB_THEME)
WebThemeContext.displayName = 'WebThemeContext'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type InkCompatProviderProps = {
  children: ReactNode
  /**
   * Called when a component invokes `useApp().exit()`.
   * Useful for navigating away, unmounting, or closing a modal.
   */
  onExit?: (error?: Error) => void
  /**
   * Override the default theme colour palette.  Merged on top of
   * `DEFAULT_WEB_THEME` so you only need to specify the keys you want to
   * change.
   */
  theme?: Partial<WebTheme>
}

/**
 * `<InkCompatProvider>` wraps your Ink component tree when rendering in a
 * browser.  It provides:
 *
 * - `WebAppContext` — satisfies `useApp()` with a web `exit()` callback
 * - `WebThemeContext` — provides the colour palette for `ThemedBox`/`ThemedText`
 *
 * Mount it once at the root of the Ink app subtree:
 *
 * ```tsx
 * <InkCompatProvider onExit={() => router.back()}>
 *   <App />
 * </InkCompatProvider>
 * ```
 */
export function InkCompatProvider({
  children,
  onExit,
  theme: themeOverride,
}: InkCompatProviderProps) {
  const [exited, setExited] = useState(false)

  const exit = useCallback(
    (error?: Error) => {
      setExited(true)
      onExit?.(error)
    },
    [onExit],
  )

  const appValue = useMemo<WebAppContextValue>(() => ({ exit }), [exit])

  const themeValue = useMemo<WebTheme>(
    () => (themeOverride ? { ...DEFAULT_WEB_THEME, ...themeOverride } : DEFAULT_WEB_THEME),
    [themeOverride],
  )

  if (exited) return null

  return (
    <WebThemeContext.Provider value={themeValue}>
      <WebAppContext.Provider value={appValue}>
        {children}
      </WebAppContext.Provider>
    </WebThemeContext.Provider>
  )
}

export default InkCompatProvider
