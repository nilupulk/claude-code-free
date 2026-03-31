'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-[var(--transition-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: 'bg-surface-800 text-surface-100 border border-surface-700 hover:bg-surface-700',
        ghost: 'text-surface-400 hover:bg-surface-800 hover:text-surface-100',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
        // Legacy aliases
        default: 'bg-brand-600 text-white hover:bg-brand-700',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-surface-700 bg-transparent hover:bg-surface-800 text-surface-200',
        link: 'text-brand-400 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-3 text-xs rounded',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        // Legacy aliases
        default: 'h-9 px-4 py-2',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const spinnerSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            className="animate-spin flex-shrink-0"
            size={spinnerSize}
            aria-hidden="true"
          />
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
