import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

function createClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export { createClient }
export const createBrowserClient = createClient
