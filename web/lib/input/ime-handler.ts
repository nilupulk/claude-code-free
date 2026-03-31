/**
 * IME (Input Method Editor) composition tracking.
 *
 * During IME composition (Japanese, Chinese, Korean, etc.) the browser fires
 * keydown events but they should NOT be processed as terminal commands —
 * the user is in the middle of constructing a character via their IME.
 *
 * compositionstart → compositionupdate* → compositionend
 *
 * While `isComposing` is true, callers should pass keyboard events straight
 * through to the textarea without interpreting them as keybindings.
 *
 * Note: nativeEvent.isComposing is also available on KeyboardEvent in modern
 * browsers, but hooking composition events directly is more reliable and gives
 * us access to the intermediate composition text for display purposes.
 */

export interface ImeState {
  /** True between compositionstart and compositionend */
  readonly isComposing: boolean
  /** The in-progress composition string (empty when not composing) */
  readonly compositionText: string
}

export interface ImeHandler {
  /** Current IME state — safe to read on every render */
  readonly state: ImeState

  /**
   * Attach composition listeners to an element.
   * Returns a cleanup function that removes all listeners.
   */
  attach(el: HTMLElement): () => void
}

/**
 * Create a shareable IME handler.
 * Pass a single instance down to all components that need to know about
 * IME state, or use the React hook wrapper `useIme` instead.
 */
export function createImeHandler(): ImeHandler {
  let isComposing = false
  let compositionText = ''

  // Listeners registered on the current element (for cleanup)
  let currentEl: HTMLElement | null = null
  let currentCleanup: (() => void) | null = null

  const handler: ImeHandler = {
    get state(): ImeState {
      return { isComposing, compositionText }
    },

    attach(el: HTMLElement): () => void {
      // Remove any previous attachment
      currentCleanup?.()

      currentEl = el
      isComposing = false
      compositionText = ''

      const onStart = () => {
        isComposing = true
        compositionText = ''
      }

      const onUpdate = (e: Event) => {
        compositionText = (e as CompositionEvent).data ?? ''
      }

      const onEnd = (e: Event) => {
        compositionText = (e as CompositionEvent).data ?? ''
        // Small delay: some browsers fire keydown AFTER compositionend for the
        // commit key (Enter). Setting isComposing=false synchronously here means
        // that keydown would be processed as a regular Enter and submit the form.
        // Using a microtask lets the current event loop tick finish first.
        Promise.resolve().then(() => {
          isComposing = false
          compositionText = ''
        })
      }

      el.addEventListener('compositionstart', onStart)
      el.addEventListener('compositionupdate', onUpdate)
      el.addEventListener('compositionend', onEnd)

      const cleanup = () => {
        el.removeEventListener('compositionstart', onStart)
        el.removeEventListener('compositionupdate', onUpdate)
        el.removeEventListener('compositionend', onEnd)
        if (currentEl === el) {
          currentEl = null
          isComposing = false
          compositionText = ''
        }
      }

      currentCleanup = cleanup
      return cleanup
    },
  }

  return handler
}
