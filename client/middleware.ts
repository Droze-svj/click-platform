// Next.js middleware with Sentry integration

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only use Sentry if it's properly initialized (DSN is set)
  const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (hasSentry) {
    try {
      // Sentry v10+ handles transactions automatically via autoInstrumentMiddleware
      // No need to manually create transactions

      // Add request context for better error tracking
      Sentry.setContext('request', {
        url: request.url,
        pathname: request.nextUrl.pathname,
      });
    } catch (error) {
      // Silently fail if Sentry is not properly configured
      console.warn('Sentry context setting failed:', error);
    }
  }

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






