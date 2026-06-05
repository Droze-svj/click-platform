import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Dev/test scaffolding pages that must NOT be reachable on the public production
 * URL (they expose debug info, server logs, or probe internals). They stay
 * available in development. Returning 404 in production hides them without
 * deleting them from the repo.
 */
const BLOCKED_IN_PROD = [
  '/debug',
  '/debug-dashboard',
  '/test-errors',
  '/test-connection',
  '/test-registration',
  '/auto-test-registration',
  '/test-debug',
  '/__probe',
  '/which-build',
]

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = req.nextUrl
    if (BLOCKED_IN_PROD.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return new NextResponse('Not found', { status: 404 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/debug/:path*',
    '/debug-dashboard/:path*',
    '/test-errors/:path*',
    '/test-connection/:path*',
    '/test-registration/:path*',
    '/auto-test-registration/:path*',
    '/test-debug/:path*',
    '/__probe/:path*',
    '/which-build/:path*',
  ],
}
