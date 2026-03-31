import { useCallback, useEffect, useRef, useState } from 'react'

export type UseFocusOptions = {
  /**
   * Auto-focus this component when it mounts.
   * @default false
   */
  autoFocus?: boolean
  /**
   * Whether this component participates in Tab focus cycling.
   * @default true
   */
  isActive?: boolean
}

export type UseFocusResult = {
  /** Whether this component is currently focused. */
  isFocused: boolean
  /** Programmatically focus this component. */
  focus: () => void
}

/**
 * Web-compat `useFocus` — provides an `isFocused` boolean and a `focus()`
 * imperative handle backed by DOM focus on a ref'd element.
 *
 * Usage:
 * ```tsx
 * const { isFocused, focus } = useFocus({ autoFocus: true })
 * return <Box ref={focusRef} tabIndex={0} onFocus={...}>...</Box>
 * ```
 *
 * Unlike Ink's `useFocus` (which manages a global focus cycle), this hook
 * tracks DOM focus state on the element returned by `focusRef`.  Attach
 * `focusRef` to a `<Box>` (or any focusable element) and give it a
 * `tabIndex` to participate in the tab order.
 */
export function useFocus(options: UseFocusOptions = {}): UseFocusResult & { focusRef: React.RefObject<HTMLElement | null> } {
  const { autoFocus = false, isActive = true } = options
  const [isFocused, setIsFocused] = useState(false)
  const focusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = focusRef.current
    if (!el) return

    const onFocus = () => setIsFocused(true)
    const onBlur = () => setIsFocused(false)

    el.addEventListener('focus', onFocus)
    el.addEventListener('blur', onBlur)

    if (autoFocus && isActive) {
      el.focus()
    }

    return () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('blur', onBlur)
    }
  }, [autoFocus, isActive])

  const focus = useCallback(() => {
    focusRef.current?.focus()
  }, [])

  return { isFocused, focus, focusRef }
}

export default useFocus
