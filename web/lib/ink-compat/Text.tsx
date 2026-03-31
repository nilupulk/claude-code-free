import React, { type CSSProperties, type ReactNode } from 'react'
import { inkTextPropsToCSS } from './prop-mapping'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BaseProps = {
  readonly color?: string
  readonly backgroundColor?: string
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strikethrough?: boolean
  readonly inverse?: boolean
  /** Controls text wrapping/truncation. Maps to CSS white-space/overflow. */
  readonly wrap?: 'wrap' | 'wrap-trim' | 'end' | 'middle' | 'truncate-end' | 'truncate' | 'truncate-middle' | 'truncate-start'
  readonly children?: ReactNode
  /** Pass-through className for web-specific styling. */
  readonly className?: string
  /** Pass-through inline style overrides. */
  readonly style?: CSSProperties
}

/**
 * Bold and dim are mutually exclusive (same constraint as Ink).
 */
type WeightProps =
  | { bold?: never; dim?: never }
  | { bold: boolean; dim?: never }
  | { dim: boolean; bold?: never }

export type TextProps = BaseProps & WeightProps

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Web-compat `<Text>` — renders as a `<span>` and maps all Ink text-style
 * props to CSS.  Drop-in replacement for Ink's `<Text>`.
 */
export function Text({
  children,
  color,
  backgroundColor,
  bold,
  dim,
  italic,
  underline,
  strikethrough,
  inverse,
  wrap,
  className,
  style: styleProp,
}: TextProps) {
  const inkCSS = inkTextPropsToCSS({
    color,
    backgroundColor,
    bold,
    dim,
    italic,
    underline,
    strikethrough,
    inverse,
    wrap,
  })

  const mergedStyle: CSSProperties = {
    // Inherit the monospace font from the root
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap', // preserve whitespace by default, like terminal
    ...inkCSS,
    ...styleProp,
  }

  return (
    <span className={className} style={mergedStyle}>
      {children}
    </span>
  )
}

export default Text
