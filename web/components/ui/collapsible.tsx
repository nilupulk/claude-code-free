'use client'

import * as React from 'react'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Collapsible = RadixCollapsible.Root
const CollapsibleTrigger = RadixCollapsible.Trigger

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof RadixCollapsible.Content>,
  React.ComponentPropsWithoutRef<typeof RadixCollapsible.Content>
>(({ className, children, ...props }, ref) => (
  <RadixCollapsible.Content
    ref={ref}
    className={cn(
      'overflow-hidden',
      'data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down-out',
      className
    )}
    {...props}
  >
    {children}
  </RadixCollapsible.Content>
))
CollapsibleContent.displayName = RadixCollapsible.Content.displayName

// Convenience accordion-style wrapper
interface CollapsibleSectionProps {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  contentClassName?: string
}

function CollapsibleSection({
  title,
  children,
  defaultOpen,
  open,
  onOpenChange,
  className,
  contentClassName,
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className={cn('rounded-md border border-surface-800', className)}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-surface-200 hover:text-surface-50 hover:bg-surface-800/50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{title}</span>
        <ChevronDown
          className="h-4 w-4 text-surface-500 transition-transform duration-[var(--transition-normal)] group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn('px-4 pb-4', contentClassName)}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleSection }
