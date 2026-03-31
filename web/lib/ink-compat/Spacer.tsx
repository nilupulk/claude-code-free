import React from 'react'

/**
 * Web-compat `<Spacer>` — renders a `<div>` with `flex: 1` to fill
 * available space in a flex container.
 * Drop-in replacement for Ink's `<Spacer>`.
 */
export function Spacer() {
  return <div style={{ flex: 1 }} />
}

export default Spacer
