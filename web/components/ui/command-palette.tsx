'use client'

import * as React from 'react'
import { Search, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './dialog'
import { ScrollArea } from './scroll-area'
import { Kbd } from './kbd'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  group?: string
  shortcut?: string
  onSelect: () => void
  keywords?: string[]
}

// ── Fuzzy search ──────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.includes(q)) return true

  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items
  return items.filter(
    (item) =>
      fuzzyMatch(query, item.label) ||
      (item.description && fuzzyMatch(query, item.description)) ||
      item.keywords?.some((kw) => fuzzyMatch(query, kw))
  )
}

// ── Component ────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandItem[]
  placeholder?: string
  loading?: boolean
  emptyMessage?: string
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Search commands…',
  loading = false,
  emptyMessage = 'No results found.',
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filtered = filterItems(items, query)

  // Group items
  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    filtered.forEach((item) => {
      const group = item.group ?? ''
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(item)
    })
    return map
  }, [filtered])

  // Flat list for keyboard navigation
  const flatList = React.useMemo(() => {
    const list: CommandItem[] = []
    grouped.forEach((g) => list.push(...g))
    return list
  }, [grouped])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flatList.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatList[activeIndex]) {
          flatList[activeIndex].onSelect()
          onOpenChange(false)
        }
        break
      case 'Escape':
        onOpenChange(false)
        break
    }
  }

  // Scroll active item into view
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        showClose={false}
        className="p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        aria-label="Command palette"
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-surface-700 px-4 py-3">
          {loading ? (
            <Loader2 className="h-4 w-4 text-surface-500 animate-spin flex-shrink-0" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none"
            aria-autocomplete="list"
            aria-controls="command-list"
            role="combobox"
            aria-expanded={filtered.length > 0}
          />
          <Kbd shortcut="esc" />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          <div
            id="command-list"
            ref={listRef}
            role="listbox"
            aria-label="Command suggestions"
          >
            {filtered.length === 0 && !loading && (
              <p className="py-8 text-center text-sm text-surface-500">{emptyMessage}</p>
            )}
            {Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group} role="group" aria-label={group || undefined}>
                {group && (
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-surface-600">
                    {group}
                  </p>
                )}
                {groupItems.map((item) => {
                  const index = flatIndex++
                  const isActive = index === activeIndex
                  return (
                    <button
                      key={item.id}
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        item.onSelect()
                        onOpenChange(false)
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                        'transition-colors duration-[var(--transition-fast)]',
                        isActive ? 'bg-surface-800 text-surface-50' : 'text-surface-300'
                      )}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 text-surface-500" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{item.label}</span>
                        {item.description && (
                          <span className="block text-xs text-surface-500 truncate mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <Kbd shortcut={item.shortcut} />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-surface-800 px-4 py-2 text-xs text-surface-600">
          <span className="flex items-center gap-1"><Kbd keys="↑" /><Kbd keys="↓" /> navigate</span>
          <span className="flex items-center gap-1"><Kbd keys="↵" /> select</span>
          <span className="flex items-center gap-1"><Kbd keys="esc" /> close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Hook for Cmd+K trigger ────────────────────────────────────────────────────

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
