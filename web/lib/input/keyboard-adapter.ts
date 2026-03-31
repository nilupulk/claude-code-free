/**
 * DOM KeyboardEvent → Ink Key format adapter.
 *
 * Converts browser keyboard events to the structured InkKey format used by
 * the keybinding resolver (src/keybindings/match.ts), so web UI can share
 * the same keybinding definitions as the terminal.
 */

/**
 * Ink's Key type — boolean flags for every named key and modifier.
 * Mirrors the Key interface from src/ink/events/input-event.ts.
 */
export interface InkKey {
  upArrow: boolean
  downArrow: boolean
  leftArrow: boolean
  rightArrow: boolean
  pageDown: boolean
  pageUp: boolean
  home: boolean
  end: boolean
  return: boolean
  escape: boolean
  ctrl: boolean
  shift: boolean
  tab: boolean
  backspace: boolean
  delete: boolean
  /** true when Alt (option) OR Meta (Cmd/Win) is held */
  meta: boolean
  /** true only for Cmd (Mac) / Win key — distinct from alt/meta */
  super: boolean
  fn: boolean
  wheelUp: boolean
  wheelDown: boolean
}

export interface AdaptedKeyEvent {
  /** Printable character, or '' for non-printable keys */
  input: string
  key: InkKey
  originalEvent: KeyboardEvent
}

// ── Browser-native shortcuts that must never be intercepted ──────────────────

/**
 * Key combos (in "modifiers+key" form) that belong to the browser/OS.
 * We never call preventDefault on these — the user needs them.
 */
const BROWSER_PASSTHROUGH = new Set([
  // Tab management
  'ctrl+t',
  'ctrl+w',
  'ctrl+n',
  'meta+t',
  'meta+w',
  'meta+n',
  // Navigation
  'ctrl+r',
  'meta+r',
  'f5',
  // DevTools
  'ctrl+shift+i',
  'ctrl+shift+j',
  'ctrl+shift+k', // Firefox devtools
  'f12',
  // Address bar / omnibox
  'ctrl+l',
  'meta+l',
  // Print
  'ctrl+p',
  'meta+p',
  // Find in page (browser-level, not terminal)
  'ctrl+f',
  'meta+f',
])

/** Produce a normalised combo string for passthrough lookup */
function comboKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.metaKey) parts.push('meta')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

/** Returns true if this event should be left entirely to the browser */
export function isBrowserShortcut(e: KeyboardEvent): boolean {
  return BROWSER_PASSTHROUGH.has(comboKey(e))
}

// ── Input text extraction ─────────────────────────────────────────────────────

/**
 * Derive the Ink "input" string from a KeyboardEvent.
 *
 * Rules (matching terminal behaviour):
 * - Single printable char with no ctrl/meta → the char itself
 * - Ctrl+letter → the letter (lower-cased) so resolver can match "ctrl+a" etc.
 * - Everything else → '' (arrows, function keys, modifier-only, etc.)
 */
function deriveInput(e: KeyboardEvent): string {
  // Printable character — includes shift variants like "A", "!", "@", …
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    return e.key
  }
  // Ctrl+letter — emit the letter so bindings like "ctrl+c" resolve correctly
  if (e.ctrlKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    return e.key.toLowerCase()
  }
  return ''
}

// ── Core adapter ──────────────────────────────────────────────────────────────

/**
 * Convert a DOM KeyboardEvent to Ink's (input, key) pair.
 * Returns null for bare modifier keypresses (Shift, Alt, etc.).
 */
export function adaptKeyboardEvent(e: KeyboardEvent): AdaptedKeyEvent | null {
  // Bare modifier keys carry no semantic meaning for bindings
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return null

  const key: InkKey = {
    upArrow: e.key === 'ArrowUp',
    downArrow: e.key === 'ArrowDown',
    leftArrow: e.key === 'ArrowLeft',
    rightArrow: e.key === 'ArrowRight',
    pageDown: e.key === 'PageDown',
    pageUp: e.key === 'PageUp',
    home: e.key === 'Home',
    end: e.key === 'End',
    return: e.key === 'Enter',
    escape: e.key === 'Escape',
    tab: e.key === 'Tab',
    backspace: e.key === 'Backspace',
    delete: e.key === 'Delete',
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    // In the terminal, key.meta covered both Alt and Meta (historical limitation).
    // On the web we keep the same convention: set meta=true when either Alt or
    // Meta is held, so keybinding definitions that say `alt` or `meta` both work.
    meta: e.altKey || e.metaKey,
    // super tracks Cmd (Mac) / Win separately — needed for `cmd+…` bindings
    // that only fire on kitty-protocol terminals in the terminal world.
    super: e.metaKey,
    fn: false,
    wheelUp: false,
    wheelDown: false,
  }

  return { input: deriveInput(e), key, originalEvent: e }
}

// ── Global listener installer ─────────────────────────────────────────────────

export interface KeyboardAdapterOptions {
  /**
   * Called with the adapted event. Return true to call preventDefault on the
   * original DOM event.
   */
  onKey: (event: AdaptedKeyEvent) => boolean | void
  /** If true, also listens on keyup (default: false) */
  listenKeyUp?: boolean
}

/**
 * Attach a document-level keydown handler that adapts events to InkKey format.
 * Browser-native shortcuts are never intercepted.
 * Returns a cleanup function to remove the listener.
 */
export function installKeyboardAdapter(options: KeyboardAdapterOptions): () => void {
  const handler = (e: KeyboardEvent) => {
    if (isBrowserShortcut(e)) return
    const adapted = adaptKeyboardEvent(e)
    if (!adapted) return
    const shouldPrevent = options.onKey(adapted)
    if (shouldPrevent) e.preventDefault()
  }

  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}

/**
 * Attach a keydown handler to a specific element (not the document).
 * Useful for scoping input handling to a single textarea/div.
 */
export function attachKeyboardAdapter(
  el: HTMLElement,
  options: KeyboardAdapterOptions,
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (isBrowserShortcut(e)) return
    const adapted = adaptKeyboardEvent(e)
    if (!adapted) return
    const shouldPrevent = options.onKey(adapted)
    if (shouldPrevent) e.preventDefault()
  }

  el.addEventListener('keydown', handler)
  return () => el.removeEventListener('keydown', handler)
}
