import React, { memo, type ReactNode } from 'react'

export type StaticProps<T> = {
  /**
   * Array of items to render once and never re-render.
   * Mirrors Ink's `<Static items={...}>` API.
   */
  items: T[]
  children: (item: T, index: number) => ReactNode
  /** Optional wrapper element style. */
  style?: React.CSSProperties
}

/**
 * Web-compat `<Static>` — renders a list of items once and memoizes the
 * output so they never re-render.  Drop-in replacement for Ink's `<Static>`.
 *
 * In Ink, Static appends items above the interactive area and never repaints
 * them.  In the web version we simply memo the rendered list; the parent can
 * place it above the interactive UI via normal layout.
 */
function StaticInner<T>({ items, children, style }: StaticProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {items.map((item, index) => (
        // Key must be stable — items are never removed once rendered
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={index}>{children(item, index)}</React.Fragment>
      ))}
    </div>
  )
}

export const Static = memo(StaticInner) as typeof StaticInner

export default Static
