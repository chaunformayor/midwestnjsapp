import { cn } from '@/lib/utils'

export function Card({ children, className, hover = false }: {
  children: React.ReactNode; className?: string; hover?: boolean
}) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-6 transition-all', hover && 'hover:-translate-y-1 hover:shadow-lg hover:border-gold cursor-pointer', className)}>
      {children}
    </div>
  )
}

export function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-navy rounded-lg p-6 text-center">
      <div className="font-head text-3xl text-gold leading-none mb-1">{value}</div>
      <div className="text-xs uppercase tracking-widest text-white/50 font-medium mt-2">{label}</div>
      {sub && <p className="text-xs text-white/40 mt-2 leading-relaxed">{sub}</p>}
    </div>
  )
}
