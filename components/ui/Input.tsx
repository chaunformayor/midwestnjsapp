import { cn } from '@/lib/utils'
import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-navy">{label}{props.required && <span className="text-gold ml-0.5">*</span>}</label>}
      <input ref={ref} className={cn('border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition bg-white text-gray-800 placeholder:text-gray-400', error && 'border-red-400 focus:border-red-400 focus:ring-red-100', className)} {...props} />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-navy">{label}{props.required && <span className="text-gold ml-0.5">*</span>}</label>}
      <select ref={ref} className={cn('border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition bg-white text-gray-800', error && 'border-red-400', className)} {...props}>{children}</select>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-navy">{label}{props.required && <span className="text-gold ml-0.5">*</span>}</label>}
      <textarea ref={ref} className={cn('border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition bg-white text-gray-800 resize-y min-h-[100px]', error && 'border-red-400', className)} {...props} />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
