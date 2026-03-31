import * as React from 'react'
import { cn } from '@/lib/utils'

// Detect macOS for ⌘ vs Ctrl display
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

const MOD_KEY = isMac() ? '⌘' : 'Ctrl'
const ALT_KEY = isMac() ? '⌥' : 'Alt'
const SHIFT_KEY = '⇧'

const KEY_MAP: Record<string, string> = {
  mod: MOD_KEY,
  cmd: '⌘',
  ctrl: 'Ctrl',
  alt: ALT_KEY,
  shift: SHIFT_KEY,
  enter: '↵',
  return: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
  esc: 'Esc',
  tab: '⇥',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  space: 'Space',
}

function formatKey(key: string): string {
  return KEY_MAP[key.toLowerCase()] ?? key.toUpperCase()
}

export interface KbdProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Key combination like "mod+k", "ctrl+shift+p", or single key "esc" */
  keys?: string
  /** Render as a group of individual Kbd elements */
  shortcut?: string
}

function Kbd({ className, keys, shortcut, children, ...props }: KbdProps) {
  if (shortcut) {
    const parts = shortcut.split('+').map((k) => k.trim())
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={shortcut}>
        {parts.map((key, i) => (
          <React.Fragment key={i}>
            <SingleKbd className={className} {...props}>
              {formatKey(key)}
            </SingleKbd>
            {i < parts.length - 1 && (
              <span className="text-surface-600 text-xs" aria-hidden="true">+</span>
            )}
          </React.Fragment>
        ))}
      </span>
    )
  }

  return (
    <SingleKbd className={className} {...props}>
      {keys ? formatKey(keys) : children}
    </SingleKbd>
  )
}

function SingleKbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded border border-surface-600',
        'bg-surface-800 px-1.5 py-0.5 font-mono text-[11px] font-medium text-surface-300',
        'shadow-[0_1px_0_0] shadow-surface-700',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}

export { Kbd }
