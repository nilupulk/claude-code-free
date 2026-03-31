import React from 'react'

export type NewlineProps = {
  /** Number of newlines to insert. Defaults to 1. */
  count?: number
}

/**
 * Web-compat `<Newline>` — renders `<br>` elements.
 * Drop-in replacement for Ink's `<Newline>`.
 */
export function Newline({ count = 1 }: NewlineProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <br key={i} />
      ))}
    </>
  )
}

export default Newline
