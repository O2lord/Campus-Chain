// middleware.ts (in the root of your project)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // This ensures the session cookies are updated in the response
  await supabase.auth.getSession()

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/student/:path*',
    '/lecturer/:path*'
  ]
}