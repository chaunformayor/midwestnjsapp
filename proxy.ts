import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Portal: requires investor or admin role
  if (pathname.startsWith('/portal')) {
    if (!user) return NextResponse.redirect(new URL('/login?next=/portal', request.url))
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'pending') return NextResponse.redirect(new URL('/pending', request.url))
    if (!profile || !['investor', 'admin'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Admin: requires admin role
  if (pathname.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login?next=/admin', request.url))
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/portal', request.url))
  }

  // Auth pages: redirect already-authenticated users
  if (['/login', '/signup'].includes(pathname) && user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (profile?.role === 'investor') return NextResponse.redirect(new URL('/portal', request.url))
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  return response
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/login', '/signup'],
}
