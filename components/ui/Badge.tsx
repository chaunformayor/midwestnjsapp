import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'gold' | 'navy' | 'gray' | 'green' | 'red' | 'custom'
}

export function Badge({ children, className, variant = 'gold' }: BadgeProps) {
  const variants = {
    gold:   'bg-gold/10 text-gold-dark border border-gold/20',
    navy:   'bg-navy/10 text-navy border border-navy/20',
    gray:   'bg-gray-100 text-gray-600',
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-700',
    custom: '',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase', variants[variant], className)}>
      {children}
    </span>
  )
}
