// "Take me back where I was" after signing in.
//
// When a session ends mid-visit, the app sends the user to /login?next=<path>,
// and the login page returns them there afterwards instead of always to
// /dashboard. `next` comes from the URL, so it is untrusted: only same-site
// relative paths are honoured (no "//evil.com", no "https://…", no scheme
// tricks), and auth pages are never a destination.

const AUTH_PAGES = /^\/(login|register|signup|forgot-password|reset-password|verify-email)(\/|$|\?)/

/** The path to return to, or the fallback when `raw` isn't a safe same-site path. */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  let path: string
  try {
    path = decodeURIComponent(String(raw)).trim()
  } catch {
    return fallback
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\\]/.test(path)) return fallback
  if (AUTH_PAGES.test(path)) return fallback
  return path
}

/** /login, carrying the current page as ?next= when it's worth returning to. */
export function loginPathForCurrentPage(): string {
  if (typeof window === 'undefined') return '/login'
  const here = `${window.location.pathname}${window.location.search}`
  const next = safeNextPath(here, '')
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
}
