import { useEffect, useLayoutEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Ink Key interface (must match src/ink/events/input-event.ts Key type)
// ---------------------------------------------------------------------------

export type Key = {
  upArrow: boolean
  downArrow: boolean
  leftArrow: boolean
  rightArrow: boolean
  pageDown: boolean
  pageUp: boolean
  wheelUp: boolean
  wheelDown: boolean
  home: boolean
  end: boolean
  return: boolean
  escape: boolean
  ctrl: boolean
  shift: boolean
  fn: boolean
  tab: boolean
  backspace: boolean
  delete: boolean
  meta: boolean
  super: boolean
}

type Handler = (input: string, key: Key) => void

type Options = {
  /**
   * Enable or disable capturing of user input.
   * @default true
   */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// DOM → Ink key mapping
// ---------------------------------------------------------------------------

function domEventToInkKey(e: KeyboardEvent): Key {
  return {
    upArrow: e.key === 'ArrowUp',
    downArrow: e.key === 'ArrowDown',
    leftArrow: e.key === 'ArrowLeft',
    rightArrow: e.key === 'ArrowRight',
    pageDown: e.key === 'PageDown',
    pageUp: e.key === 'PageUp',
    wheelUp: false,
    wheelDown: false,
    home: e.key === 'Home',
    end: e.key === 'End',
    return: e.key === 'Enter',
    escape: e.key === 'Escape',
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    fn: e.key.startsWith('F') && e.key.length <= 3 && !isNaN(Number(e.key.slice(1))),
    tab: e.key === 'Tab',
    backspace: e.key === 'Backspace',
    delete: e.key === 'Delete',
    meta: e.altKey,   // Alt = meta in terminal convention
    super: e.metaKey, // Cmd/Win = super
  }
}

/**
 * Derive the Ink `input` string from a DOM keyboard event.
 * Special/non-printable keys yield an empty string; printable chars
 * yield the character itself (ctrl+letter yields the letter name).
 */
function domEventToInput(e: KeyboardEvent): string {
  const SPECIAL_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'PageUp', 'PageDown', 'Home', 'End',
    'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
    'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
    'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  ])

  if (SPECIAL_KEYS.has(e.key)) return ''
  if (e.key.length !== 1) return ''

  // Ctrl+letter: return the letter (like Ink does)
  if (e.ctrlKey) return e.key.toLowerCase()

  return e.key
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Web-compat `useInput` — attaches a `keydown` listener to `document` and
 * calls `handler(input, key)` on each keystroke, using the same `Key`
 * interface as Ink's `useInput`.
 *
 * Arrow keys, Enter, Escape, Tab and other special keys are NOT prevented by
 * default — components that need to suppress browser defaults should call
 * `e.preventDefault()` in their own handlers or use `useInput` with a
 * focusable element.
 */
const useInput = (inputHandler: Handler, options: Options = {}): void => {
  const { isActive = true } = options

  // Keep a stable ref to the latest handler so we don't re-attach on every render.
  const handlerRef = useRef<Handler>(inputHandler)
  useLayoutEffect(() => {
    handlerRef.current = inputHandler
  })

  useEffect(() => {
    if (!isActive) return

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't fire inside text inputs / textareas unless the app wants it
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      const key = domEventToInkKey(e)
      const input = domEventToInput(e)
      handlerRef.current(input, key)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isActive])
}

export default useInput
