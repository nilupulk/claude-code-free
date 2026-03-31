// src/ink/global.d.ts
// Global type augmentations for Ink's custom JSX elements.
// Imported by Box.tsx and ScrollBox.tsx to register ink-box / ink-text etc.
// in the React JSX intrinsic elements namespace so TypeScript accepts
// <ink-box>, <ink-text>, and friends without "unknown element" errors.

import type { DOMElement } from './dom.js'
import type { Styles, TextStyles } from './styles.js'
import type {
  ClickEvent,
  ClickEventHandler,
} from './events/click-event.js'
import type { FocusEvent } from './events/focus-event.js'
import type { KeyboardEvent } from './events/keyboard-event.js'
import type { MouseEvent } from './events/mouse-event.js'

type InkBoxIntrinsicProps = {
  ref?: React.Ref<DOMElement>
  style?: Styles
  tabIndex?: number
  autoFocus?: boolean
  children?: React.ReactNode
  // Event handlers wired by the reconciler dispatcher
  onClick?: ClickEventHandler
  onFocus?: (event: FocusEvent) => void
  onFocusCapture?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onBlurCapture?: (event: FocusEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyDownCapture?: (event: KeyboardEvent) => void
  // Scroll attributes set via setAttribute
  [key: string]: unknown
}

type InkTextIntrinsicProps = {
  style?: Styles
  textStyles?: TextStyles
  children?: React.ReactNode
  [key: string]: unknown
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'ink-root': InkBoxIntrinsicProps
        'ink-box': InkBoxIntrinsicProps
        'ink-text': InkTextIntrinsicProps
        'ink-virtual-text': InkTextIntrinsicProps
        'ink-link': InkTextIntrinsicProps & { url?: string }
        'ink-progress': { [key: string]: unknown }
        'ink-raw-ansi': { [key: string]: unknown }
      }
    }
  }
}
