/**
 * Dev/test scaffolding routes answer 404 in production by themselves, not only
 * because middleware hides them: middleware can be skipped (CVE-2025-29927,
 * `x-middleware-subrequest`), and these were reachable that way.
 */
export function devOnlyNotFound(): Response | null {
  return process.env.NODE_ENV === 'production' ? new Response('Not found', { status: 404 }) : null
}
