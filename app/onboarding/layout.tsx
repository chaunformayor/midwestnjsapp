import type { Metadata } from 'next'
import { MIS_CONTACT } from '@/lib/onboarding/config'

export const metadata: Metadata = {
  title: 'Client onboarding',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="bg-navy px-4">
        <div className="max-w-[1180px] mx-auto py-4 flex flex-col leading-tight">
          <span className="font-head text-white text-[19px]">Midwest Investor Services</span>
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-gold mt-1">Client onboarding</span>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 py-7 sm:py-9">{children}</main>
      <footer className="border-t border-gray-200 px-4">
        <div className="max-w-[1180px] mx-auto py-5 text-xs text-gray-500 flex flex-wrap gap-x-5 gap-y-1">
          <span>Midwest Investor Services · St. Louis, Missouri</span>
          <span>{MIS_CONTACT.phone}</span>
          <span>{MIS_CONTACT.email}</span>
        </div>
      </footer>
    </div>
  )
}
