'use client'

import * as React from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> {
  label?: string
  description?: string
}

const Switch = React.forwardRef<React.ElementRef<typeof RadixSwitch.Root>, SwitchProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const switchId = id ?? React.useId()

    if (label) {
      return (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label
              htmlFor={switchId}
              className="text-sm font-medium text-surface-200 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-surface-500">{description}</p>
            )}
          </div>
          <SwitchRoot ref={ref} id={switchId} className={className} {...props} />
        </div>
      )
    }

    return <SwitchRoot ref={ref} id={switchId} className={className} {...props} />
  }
)
Switch.displayName = 'Switch'

const SwitchRoot = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-colors duration-[var(--transition-normal)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'bg-surface-700 data-[state=checked]:bg-brand-500',
      className
    )}
    {...props}
  >
    <RadixSwitch.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm',
        'transition-transform duration-[var(--transition-normal)]',
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </RadixSwitch.Root>
))
SwitchRoot.displayName = RadixSwitch.Root.displayName

export { Switch }
