import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Midwest Investor Services', template: '%s | MIS' },
  description: "St. Louis's premier buy-and-hold real estate investment partner. Deal sourcing, rehab, and full property management under one roof.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://midwestinvestorservices.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
