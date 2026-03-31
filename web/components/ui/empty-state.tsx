import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-surface-700 bg-surface-800 text-surface-400">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-sm">
        <h3 className="text-sm font-semibold text-surface-200">{title}</h3>
        {description && (
          <p className="text-sm text-surface-500 leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
