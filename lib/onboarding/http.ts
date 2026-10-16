import { NextResponse } from 'next/server'
import { NextcloudError } from '@/lib/nextcloud'
import { UserError } from './service'
import { resolveToken, type Engagement, type Person } from './server'

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function ok<T>(data: T) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export function handleError(err: unknown) {
  if (err instanceof UserError) return fail(err.message, err.status)
  if (err instanceof NextcloudError) {
    console.error('onboarding: Nextcloud error', err.status, err.message)
    return fail("We couldn't reach our secure document storage. Please try again in a minute.", 502)
  }
  console.error('onboarding: unexpected error', err)
  return fail('Something went wrong on our side. Please try again, or call us at 636-590-7698.', 500)
}

/** Runs a client handler after looking up the engagement and the person from their private link. */
export async function withClient(token: string, fn: (e: Engagement, person: Person) => Promise<Response>) {
  try {
    const found = await resolveToken(token)
    if (!found) return fail('This onboarding link is not valid. Check the link in your email, or contact us for a new one.', 404)
    if (found.e.status === 'canceled') return fail('This onboarding was canceled. Please contact us if you need a new link.', 410)
    return await fn(found.e, found.person)
  } catch (err) {
    return handleError(err)
  }
}
