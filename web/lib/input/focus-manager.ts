/**
 * Focus management system.
 *
 * Provides:
 * - Focus trap within modals/dialogs (Tab/Shift+Tab cycles inside container)
 * - Escape key to release trap and restore prior focus
 * - Utility to collect all focusable elements in DOM order
 *
 * Designed to be used without React (plain DOM) so it can be consumed both
 * by React components (via the hook below) and imperative code.
 */

// ── Focusable element detection ───────────────────────────────────────────────

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'details > summary',
].join(', ')

/**
 * Return all focusable elements inside `container`, in DOM order,
 * excluding elements that are hidden or inside an inert subtree.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
  ).filter((el) => {
    if (el.closest('[inert]')) return false
    // offsetParent is null for display:none elements (except fixed positioning)
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return true
  })
}

// ── Focus trap ────────────────────────────────────────────────────────────────

export interface FocusTrapOptions {
  /**
   * Called when the user presses Escape inside the trap.
   * Typically closes the dialog and calls `restoreFocus()`.
   */
  onEscape?: () => void

  /**
   * Element to focus when the trap activates. Falls back to the first
   * focusable element in the container.
   */
  initialFocus?: HTMLElement | null

  /**
   * If true, focus is NOT moved automatically when the trap is installed.
   * Use when you want to control focus timing yourself.
   */
  skipInitialFocus?: boolean
}

/**
 * Install a focus trap inside `container`.
 *
 * - Tab / Shift+Tab wraps around within the container's focusable elements.
 * - Escape calls `options.onEscape` (if provided).
 * - Focus is moved to `initialFocus` or the first focusable child.
 *
 * Returns a cleanup function that removes the listeners (does NOT move focus).
 */
export function trapFocus(container: HTMLElement, options: FocusTrapOptions = {}): () => void {
  const { onEscape, initialFocus, skipInitialFocus = false } = options

  if (!skipInitialFocus) {
    const target = initialFocus ?? getFocusableElements(container)[0]
    target?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onEscape?.()
      return
    }

    if (e.key !== 'Tab') return

    const focusable = getFocusableElements(container)
    if (focusable.length === 0) {
      e.preventDefault()
      return
    }

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    const active = document.activeElement as HTMLElement | null

    if (e.shiftKey) {
      // Shift+Tab: wrap from first → last
      if (!active || active === first || !container.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      // Tab: wrap from last → first
      if (!active || active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)
  return () => container.removeEventListener('keydown', handleKeyDown)
}

// ── Focus manager class ───────────────────────────────────────────────────────

/**
 * Stateful focus manager that handles focus save/restore across dialogs.
 *
 * Usage:
 * ```
 * const fm = new FocusManager()
 *
 * // Opening a dialog:
 * fm.saveFocus()
 * fm.trapFocus(dialogEl, { onEscape: closeDialog })
 *
 * // Closing a dialog:
 * fm.releaseTrap()
 * fm.restoreFocus()
 * ```
 */
export class FocusManager {
  private _savedElement: HTMLElement | null = null
  private _trapCleanup: (() => void) | null = null

  /** Save the currently focused element so it can be restored later. */
  saveFocus(): void {
    this._savedElement = document.activeElement as HTMLElement | null
  }

  /** Restore focus to the previously saved element. */
  restoreFocus(): void {
    if (this._savedElement && typeof this._savedElement.focus === 'function') {
      this._savedElement.focus()
    }
    this._savedElement = null
  }

  /**
   * Install a focus trap on `container`. Any previous trap is released first.
   * Returns the cleanup function (also stored internally).
   */
  trapFocus(container: HTMLElement, options?: FocusTrapOptions): () => void {
    this._trapCleanup?.()
    const cleanup = trapFocus(container, options)
    this._trapCleanup = cleanup
    return cleanup
  }

  /** Release the active focus trap without restoring focus. */
  releaseTrap(): void {
    this._trapCleanup?.()
    this._trapCleanup = null
  }

  /** Release trap and restore focus in one call. */
  close(): void {
    this.releaseTrap()
    this.restoreFocus()
  }
}
