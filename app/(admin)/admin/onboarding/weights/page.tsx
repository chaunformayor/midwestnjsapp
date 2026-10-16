import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getWeights } from '@/lib/onboarding/review/service'
import WeightsForm from '@/components/onboarding/WeightsForm'

export const dynamic = 'force-dynamic'

export default async function WeightsPage() {
  const weights = await getWeights().catch(() => null)
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/admin/onboarding" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-4"><ArrowLeft className="w-4 h-4" /> All clients</Link>
      <h1 className="font-head text-navy text-3xl">Review weights</h1>
      <p className="text-gray-500 text-sm mt-1 mb-6 max-w-[62ch]">
        How much each area counts when a client&apos;s answers are scored. A higher weight moves that area up the list of recommendations. The client&apos;s own goal ratings (High, Medium, Low) then raise or lower each area for that client.
      </p>
      {weights ? <WeightsForm initial={weights} /> : <p className="text-sm text-red-700">Couldn&apos;t load the weights.</p>}
    </div>
  )
}
