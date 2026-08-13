'use client'
import { useState } from 'react'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function SubmitDealPage() {
  const [form, setForm] = useState({
    submitter_name: '', submitter_email: '', submitter_phone: '',
    property_address: '', asking_price: '', arv: '', rehab_estimate: '',
    property_type: '', bedrooms: '', bathrooms: '', sqft: '',
    notes: ''
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const res = await fetch('/api/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Deal Submission</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">Submit a Deal</h1>
          <p className="text-white/65 text-base">
            We review every submission within 48 hours. Whether you&apos;re a wholesaler, agent, or fellow investor — if the numbers work, we close.
          </p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white rounded-xl border border-gray-100 p-8">
            {status === 'done' ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">✓</div>
                <h3 className="font-head text-navy text-xl mb-2">Deal Submitted</h3>
                <p className="text-gray-500 text-sm">We&apos;ll review and reach out within 48 hours. Thanks for sending it our way.</p>
              </div>
            ) : (
              <>
                <h2 className="font-head text-navy text-xl mb-6">Property Details</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Your Name" value={form.submitter_name} onChange={set('submitter_name')} required />
                    <Input label="Your Email" type="email" value={form.submitter_email} onChange={set('submitter_email')} required />
                  </div>
                  <Input label="Your Phone" type="tel" value={form.submitter_phone} onChange={set('submitter_phone')} />
                  <Input label="Property Address" value={form.property_address} onChange={set('property_address')} required />
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Input label="Asking Price ($)" type="number" value={form.asking_price} onChange={set('asking_price')} required />
                    <Input label="ARV Estimate ($)" type="number" value={form.arv} onChange={set('arv')} hint="After repair value" />
                    <Input label="Rehab Estimate ($)" type="number" value={form.rehab_estimate} onChange={set('rehab_estimate')} />
                  </div>
                  <Select label="Property Type" value={form.property_type} onChange={set('property_type')} required>
                    <option value="">Select type…</option>
                    <option>Single Family</option>
                    <option>Duplex</option>
                    <option>Triplex</option>
                    <option>Fourplex</option>
                    <option>Multi-family (5+)</option>
                    <option>Commercial</option>
                    <option>Other</option>
                  </Select>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={set('bedrooms')} />
                    <Input label="Bathrooms" type="number" value={form.bathrooms} onChange={set('bathrooms')} />
                    <Input label="Sq Ft" type="number" value={form.sqft} onChange={set('sqft')} />
                  </div>
                  <Textarea label="Additional Notes" value={form.notes} onChange={set('notes')} placeholder="Condition, motivation, timeline, any details that help us evaluate faster…" />
                  {status === 'error' && <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>}
                  <Button type="submit" loading={status === 'loading'} className="w-full mt-1">Submit Deal</Button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
