import React, { type ReactNode } from 'react'

export type TransformProps = {
  /**
   * A function that transforms the rendered string output.
   * In Ink this intercepts the ANSI output buffer; on the web we apply it
   * to direct text children only — non-string children are passed through.
   */
  transform: (output: string) => string
  children?: ReactNode
}

/**
 * Web-compat `<Transform>` — applies a string transformation to immediate
 * text children.  Non-string children are rendered unchanged.
 *
 * Note: In Ink, Transform operates on the raw ANSI output, giving it full
 * control over the rendered bytes.  On the web it can only transform plain
 * string children directly.  Components that rely on Transform for ANSI
 * manipulation won't behave identically, but common use-cases (case changes,
 * trimming, etc.) work fine.
 */
export function Transform({ transform, children }: TransformProps) {
  const transformed = React.Children.map(children, (child) => {
    if (typeof child === 'string') return transform(child)
    if (typeof child === 'number') return transform(String(child))
    return child
  })

  return <>{transformed}</>
}

export default Transform
