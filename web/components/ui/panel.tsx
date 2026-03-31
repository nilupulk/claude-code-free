'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Orientation = 'horizontal' | 'vertical'

interface PanelGroupProps {
  orientation?: Orientation
  children: React.ReactNode
  className?: string
}

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number // percentage, 0-100
  minSize?: number     // percentage, 0-100
  maxSize?: number     // percentage, 0-100
}

// ── PanelGroup ────────────────────────────────────────────────────────────────

export function PanelGroup({ orientation = 'horizontal', children, className }: PanelGroupProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
      data-orientation={orientation}
    >
      {children}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className, defaultSize, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        style={{
          ...(defaultSize !== undefined ? { flex: `0 0 ${defaultSize}%` } : { flex: 1 }),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Panel.displayName = 'Panel'

// ── PanelResizeHandle ─────────────────────────────────────────────────────────

interface PanelResizeHandleProps {
  orientation?: Orientation
  className?: string
  onResize?: (delta: number) => void
}

export function PanelResizeHandle({
  orientation = 'horizontal',
  className,
  onResize,
}: PanelResizeHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const handleRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startPos = orientation === 'horizontal' ? e.clientX : e.clientY

    const onMove = (moveEvent: MouseEvent) => {
      const currentPos = orientation === 'horizontal' ? moveEvent.clientX : moveEvent.clientY
      onResize?.(currentPos - startPos)
    }

    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation={orientation}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      className={cn(
        'group relative flex items-center justify-center bg-surface-800',
        'transition-colors hover:bg-brand-500/30 focus-visible:outline-none focus-visible:bg-brand-500/30',
        orientation === 'horizontal' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
        isDragging && 'bg-brand-500/50',
        className
      )}
    >
      {/* Visual drag indicator */}
      <div
        className={cn(
          'rounded-full bg-surface-600 group-hover:bg-brand-400 transition-colors',
          orientation === 'horizontal' ? 'h-8 w-0.5' : 'h-0.5 w-8',
          isDragging && 'bg-brand-400'
        )}
        aria-hidden="true"
      />
    </div>
  )
}

// ── Stateful resizable panel pair ─────────────────────────────────────────────

interface ResizablePanelPairProps {
  orientation?: Orientation
  first: React.ReactNode
  second: React.ReactNode
  defaultSplit?: number // 0-100, percentage for first panel
  minFirst?: number
  maxFirst?: number
  className?: string
}

export function ResizablePanelPair({
  orientation = 'horizontal',
  first,
  second,
  defaultSplit = 50,
  minFirst = 15,
  maxFirst = 85,
  className,
}: ResizablePanelPairProps) {
  const [split, setSplit] = React.useState(defaultSplit)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handleResize = (delta: number) => {
    if (!containerRef.current) return
    const containerSize =
      orientation === 'horizontal'
        ? containerRef.current.offsetWidth
        : containerRef.current.offsetHeight
    const deltaPercent = (delta / containerSize) * 100
    setSplit((prev) => Math.max(minFirst, Math.min(maxFirst, prev + deltaPercent)))
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
    >
      <Panel className="overflow-auto" style={{ flex: `0 0 ${split}%` }}>
        {first}
      </Panel>
      <PanelResizeHandle orientation={orientation} onResize={handleResize} />
      <Panel className="overflow-auto" style={{ flex: 1 }}>
        {second}
      </Panel>
    </div>
  )
}
