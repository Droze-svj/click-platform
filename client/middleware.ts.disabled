// Temporarily disable middleware to test if it's causing build issues
// export function middleware(request: NextRequest) {
//   const response = NextResponse.next();
//   response.headers.set('X-Request-Path', request.nextUrl.pathname);
//   response.headers.set('X-Debug-Marker', 'run39');
//   response.headers.set('X-Debug-ReqTs', String(Date.now()));
//   return response;
// }

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






