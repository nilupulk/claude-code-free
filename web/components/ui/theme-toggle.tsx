'use client'

import * as React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SimpleTooltip } from './tooltip'
import { useTheme } from '@/components/layout/ThemeProvider'

type Theme = 'light' | 'dark' | 'system'

const themeConfig: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: 'dark', icon: Moon, label: 'Dark theme' },
  { value: 'light', icon: Sun, label: 'Light theme' },
  { value: 'system', icon: Monitor, label: 'System theme' },
]

interface ThemeToggleProps {
  className?: string
  variant?: 'icon' | 'segmented'
}

export function ThemeToggle({ className, variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (variant === 'segmented') {
    return (
      <div
        role="radiogroup"
        aria-label="Color theme"
        className={cn(
          'inline-flex items-center rounded-lg border border-surface-700 bg-surface-900 p-1 gap-0.5',
          className
        )}
      >
        {themeConfig.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            className={cn(
              'flex items-center justify-center rounded-md p-1.5 transition-colors duration-[var(--transition-fast)]',
              theme === value
                ? 'bg-surface-700 text-surface-100'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    )
  }

  // Cycle through themes on click
  const currentIndex = themeConfig.findIndex((t) => t.value === theme)
  const next = themeConfig[(currentIndex + 1) % themeConfig.length]
  const current = themeConfig[currentIndex] ?? themeConfig[0]
  const CurrentIcon = current.icon

  return (
    <SimpleTooltip content={`Switch to ${next.label.toLowerCase()}`} asChild>
      <button
        onClick={() => setTheme(next.value)}
        aria-label={`Current: ${current.label}. Click to switch to ${next.label}.`}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md',
          'text-surface-400 hover:text-surface-100 hover:bg-surface-800',
          'transition-colors duration-[var(--transition-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <CurrentIcon
          className="h-4 w-4 transition-transform duration-[var(--transition-normal)]"
          aria-hidden="true"
        />
      </button>
    </SimpleTooltip>
  )
}
