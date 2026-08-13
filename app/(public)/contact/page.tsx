'use client'
import { useState } from 'react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const res = await fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Get In Touch</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">Contact Us</h1>
          <p className="text-white/65 text-base">Ready to invest or just have questions? We&apos;re here Monday–Friday 8AM–6PM CT.</p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-14">
          {/* Info */}
          <div>
            <h2 className="font-head text-navy text-2xl mb-6">Let&apos;s Connect</h2>
            <div className="flex flex-col gap-5 mb-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-navy">Phone</div>
                  <a href="tel:6365907698" className="text-gray-500 text-sm hover:text-gold transition">636-590-7698</a>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-navy">Email</div>
                  <a href="mailto:info@midwestinvestorservices.com" className="text-gray-500 text-sm hover:text-gold transition">info@midwestinvestorservices.com</a>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-navy">Location</div>
                  <p className="text-gray-500 text-sm">St. Louis, Missouri</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-navy">Hours</div>
                  <p className="text-gray-500 text-sm">Mon–Fri 8AM–6PM CT</p>
                </div>
              </div>
            </div>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
              className="inline-block bg-gold text-navy font-semibold px-6 py-3 rounded hover:bg-gold-dark transition text-sm">
              Schedule a Call via Zoho Bookings
            </a>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-100 p-8">
            {status === 'done' ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✓</div>
                <h3 className="font-head text-navy text-xl mb-2">Message Sent</h3>
                <p className="text-gray-500 text-sm">We&apos;ll get back to you within one business day.</p>
              </div>
            ) : (
              <>
                <h2 className="font-head text-navy text-xl mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input label="Your Name" value={form.name} onChange={set('name')} required />
                  <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
                  <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
                  <Input label="Subject" value={form.subject} onChange={set('subject')} required />
                  <Textarea label="Message" value={form.message} onChange={set('message')} required rows={5} />
                  {status === 'error' && <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>}
                  <Button type="submit" loading={status === 'loading'} className="w-full mt-1">Send Message</Button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
