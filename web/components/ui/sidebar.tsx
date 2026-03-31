'use client'

import * as React from 'react'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SimpleTooltip } from './tooltip'

const SIDEBAR_WIDTH = 240
const SIDEBAR_COLLAPSED_WIDTH = 52
const STORAGE_KEY = 'sidebar-collapsed'

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  width: number
}

const SidebarContext = React.createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  width: SIDEBAR_WIDTH,
})

export function useSidebar() {
  return React.useContext(SidebarContext)
}

interface SidebarProviderProps {
  children: React.ReactNode
  defaultCollapsed?: boolean
}

export function SidebarProvider({ children, defaultCollapsed = false }: SidebarProviderProps) {
  const [collapsed, setCollapsedState] = React.useState(defaultCollapsed)

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsedState(stored === 'true')
  }, [])

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v)
    localStorage.setItem(STORAGE_KEY, String(v))
  }, [])

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, width }}>
      {children}
    </SidebarContext.Provider>
  )
}

interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  const { collapsed, setCollapsed, width } = useSidebar()
  const [isResizing, setIsResizing] = React.useState(false)
  const sidebarRef = React.useRef<HTMLElement>(null)

  // Drag-to-resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      // Auto-collapse if dragged past threshold
      if (delta < -SIDEBAR_WIDTH / 2) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
      }
    }

    const onUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width }}
      className={cn(
        'relative flex flex-col flex-shrink-0 h-full',
        'bg-surface-900 border-r border-surface-800',
        'transition-[width] duration-[var(--transition-normal)]',
        isResizing && 'select-none',
        className
      )}
      aria-label="Sidebar navigation"
    >
      {/* Content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-2 border-t border-surface-800">
        <SimpleTooltip
          content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          side="right"
          asChild
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </SimpleTooltip>
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-500/40 active:bg-brand-500/60 transition-colors"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed)
          }}
        />
      )}
    </aside>
  )
}

// ── Sidebar sub-components ────────────────────────────────────────────────────

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-3 border-b border-surface-800', className)}
      {...props}
    />
  )
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex-1 overflow-y-auto py-2', className)} {...props} />
  )
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-3 py-3 border-t border-surface-800', className)}
      {...props}
    />
  )
}

interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
  active?: boolean
  badge?: React.ReactNode
}

export function SidebarItem({ icon, label, active, badge, className, ...props }: SidebarItemProps) {
  const { collapsed } = useSidebar()
  const button = (
    <button
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2',
        'text-sm transition-colors duration-[var(--transition-fast)]',
        active
          ? 'bg-brand-500/15 text-brand-300 font-medium'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800',
        collapsed && 'justify-center px-0',
        className
      )}
      aria-current={active ? 'page' : undefined}
      {...props}
    >
      {icon && (
        <span className="flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </>
      )}
    </button>
  )

  if (collapsed) {
    return (
      <SimpleTooltip content={label} side="right" asChild>
        {button}
      </SimpleTooltip>
    )
  }

  return button
}
