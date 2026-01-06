// Next.js middleware - simplified version (updated 2025-01-06)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add custom header for tracking (optional)
  response.headers.set('X-Request-Path', request.nextUrl.pathname);
  // Hard proof marker that the browser is hitting the current Next dev server.
  response.headers.set('X-Debug-Marker', 'run39');
  response.headers.set('X-Debug-ReqTs', String(Date.now()));

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};






