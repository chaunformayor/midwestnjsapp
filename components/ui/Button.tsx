'use client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'outline-gold' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded transition-all whitespace-nowrap'
    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-sm',
      lg: 'px-8 py-4 text-base',
    }
    const variants = {
      primary:      'bg-gold text-navy hover:bg-gold-dark shadow-sm hover:-translate-y-px',
      outline:      'border-2 border-white text-white hover:bg-white hover:text-navy',
      'outline-gold': 'border-2 border-gold text-gold hover:bg-gold hover:text-navy',
      ghost:        'text-gray-600 hover:bg-gray-100',
      danger:       'bg-red-600 text-white hover:bg-red-700',
    }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, sizes[size], variants[variant], (disabled || loading) && 'opacity-60 cursor-not-allowed', className)}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
