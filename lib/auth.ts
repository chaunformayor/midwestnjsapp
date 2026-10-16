import { createServerClient } from '@/lib/supabase/server'

/** The signed-in user if they are an admin, otherwise null. For API routes. */
export async function currentAdmin(): Promise<{ id: string; email?: string } | null> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    return profile?.role === 'admin' ? { id: user.id, email: user.email ?? undefined } : null
  } catch {
    return null
  }
}
