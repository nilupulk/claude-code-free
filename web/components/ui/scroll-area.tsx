'use client'

import * as React from 'react'
import * as RadixScrollArea from '@radix-ui/react-scroll-area'
import { cn } from '@/lib/utils'

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof RadixScrollArea.Root>,
  React.ComponentPropsWithoutRef<typeof RadixScrollArea.Root>
>(({ className, children, ...props }, ref) => (
  <RadixScrollArea.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    <RadixScrollArea.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </RadixScrollArea.Viewport>
    <ScrollBar />
    <ScrollBar orientation="horizontal" />
    <RadixScrollArea.Corner />
  </RadixScrollArea.Root>
))
ScrollArea.displayName = RadixScrollArea.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof RadixScrollArea.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof RadixScrollArea.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <RadixScrollArea.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <RadixScrollArea.ScrollAreaThumb
      className="relative flex-1 rounded-full bg-surface-700 hover:bg-surface-600 transition-colors"
    />
  </RadixScrollArea.ScrollAreaScrollbar>
))
ScrollBar.displayName = RadixScrollArea.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
