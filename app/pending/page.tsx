import Link from 'next/link'

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="font-head text-navy text-2xl mb-2">Account Under Review</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">
          Thank you for signing up. Your investor account is currently being reviewed by our team.
          You&apos;ll receive an email at the address you registered with once your account is approved (usually within 24–48 hours).
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Questions? Call us at <a href="tel:6365907698" className="text-gold hover:underline">636-590-7698</a> or email{' '}
          <a href="mailto:info@midwestinvestorservices.com" className="text-gold hover:underline">info@midwestinvestorservices.com</a>.
        </p>
        <Link href="/" className="text-sm text-gold font-semibold hover:text-gold-dark transition">
          ← Return to main site
        </Link>
      </div>
    </div>
  )
}
