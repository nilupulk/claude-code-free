import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  border?: boolean
  sticky?: boolean
}

export function Header({
  className,
  breadcrumbs,
  actions,
  border = true,
  sticky = true,
  children,
  ...props
}: HeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 py-2.5 min-h-[48px]',
        'bg-surface-900/80 backdrop-blur-sm',
        border && 'border-b border-surface-800',
        sticky && 'sticky top-0 z-30',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb items={breadcrumbs} />
        ) : (
          children
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">{actions}</div>
      )}
    </header>
  )
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <React.Fragment key={i}>
              <li>
                {item.href && !isLast ? (
                  <a
                    href={item.href}
                    className="text-surface-500 hover:text-surface-200 transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    className={isLast ? 'text-surface-100 font-medium' : 'text-surface-500'}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 text-surface-700" />
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
