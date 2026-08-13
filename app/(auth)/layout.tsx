export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-head text-white text-2xl">Midwest Investor Services</div>
          <div className="text-[11px] uppercase tracking-widest text-gold mt-1">Investor Portal</div>
        </div>
        {children}
      </div>
    </div>
  )
}
