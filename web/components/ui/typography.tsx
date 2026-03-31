import * as React from 'react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Headings ─────────────────────────────────────────────────────────────────

export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn('scroll-m-20 text-4xl font-bold tracking-tight text-surface-50 lg:text-5xl', className)}
      {...props}
    />
  )
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'scroll-m-20 border-b border-surface-800 pb-2 text-3xl font-semibold tracking-tight text-surface-50 first:mt-0',
        className
      )}
      {...props}
    />
  )
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('scroll-m-20 text-2xl font-semibold tracking-tight text-surface-50', className)}
      {...props}
    />
  )
}

export function H4({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn('scroll-m-20 text-xl font-semibold tracking-tight text-surface-100', className)}
      {...props}
    />
  )
}

export function P({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('leading-7 text-surface-300 [&:not(:first-child)]:mt-6', className)}
      {...props}
    />
  )
}

export function Lead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xl text-surface-400', className)} {...props} />
  )
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-surface-500', className)} {...props} />
  )
}

// ── Inline code ───────────────────────────────────────────────────────────────

export function Code({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        'relative rounded bg-code-surface px-[0.3em] py-[0.15em] font-mono text-[0.875em] text-code-surface-text',
        className
      )}
      {...props}
    />
  )
}

// ── Code block with copy button ───────────────────────────────────────────────

interface PreProps extends React.HTMLAttributes<HTMLPreElement> {
  copyable?: boolean
}

export function Pre({ className, children, copyable = true, ...props }: PreProps) {
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLPreElement>(null)

  const handleCopy = async () => {
    const text = ref.current?.textContent ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre
        ref={ref}
        className={cn(
          'overflow-x-auto rounded-lg border border-surface-800 bg-code-surface p-4',
          'font-mono text-sm text-code-surface-text leading-relaxed',
          className
        )}
        {...props}
      >
        {children}
      </pre>
      {copyable && (
        <button
          onClick={handleCopy}
          className={cn(
            'absolute right-3 top-3 rounded-md p-1.5',
            'bg-surface-800 border border-surface-700 text-surface-400',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--transition-fast)]',
            'hover:text-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'focus-visible:opacity-100'
          )}
          aria-label={copied ? 'Copied!' : 'Copy code'}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
}

// ── Link ──────────────────────────────────────────────────────────────────────

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  external?: boolean
}

export function Link({ className, children, href, external, target, rel, ...props }: LinkProps) {
  const isExternal = external ?? (href?.startsWith('http') || href?.startsWith('//'))
  const resolvedTarget = target ?? (isExternal ? '_blank' : undefined)
  const resolvedRel = rel ?? (isExternal ? 'noopener noreferrer' : undefined)

  return (
    <a
      href={href}
      target={resolvedTarget}
      rel={resolvedRel}
      className={cn(
        'inline-flex items-center gap-1 text-brand-400 underline-offset-4',
        'hover:text-brand-300 hover:underline transition-colors duration-[var(--transition-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        className
      )}
      {...props}
    >
      {children}
      {isExternal && (
        <ExternalLink className="h-3 w-3 flex-shrink-0" aria-label="(opens in new tab)" />
      )}
    </a>
  )
}
