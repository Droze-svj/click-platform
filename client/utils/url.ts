import { API_URL } from '../lib/api';

/**
 * Gets the base backend URL (without /api suffix)
 */
export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl.includes('/api')) {
      return envUrl.replace(/\/api\/?$/, '');
    }
    if (envUrl) return envUrl;
    
    // Fallback to local dev API port 5001 if on localhost
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return 'http://localhost:5001';
    }
    
    // Default to relative if no env var, which works with proxy
    return '';
  }
  
  // Server-side fallback
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:5001';
  return envUrl.replace(/\/api\/?$/, '');
}

/**
 * Gets the absolute URL for a static asset from the backend
 */
export function getAssetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  const backendUrl = getBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${backendUrl}${normalizedPath}`;
}

/**
 * Resolve a URL for a <video>/<audio> media element so it loads SAME-ORIGIN.
 *
 * Media elements obey the page's CSP `media-src`, which allows `'self'`. Loading
 * from the cross-origin backend (http://localhost:5001 in dev) is blocked there,
 * so the editor video showed a silent blank. Next already proxies `/uploads/*`
 * to the backend (see next.config.js rewrites), so we return a RELATIVE
 * `/uploads/...` path (preserving the signed `?exp=&sig=` query) — same-origin,
 * no CSP/CORS block, works in dev and prod. Genuine external URLs (cloud storage)
 * pass through untouched.
 */
export function getMediaUrl(path: string): string {
  if (!path) return '';
  // Locally-generated media (blob:/data:) is already same-origin — never rewrite
  // it (prepending '/' would corrupt the URL).
  if (/^(blob:|data:)/i.test(path)) return path;
  const backendUrl = getBackendUrl();
  if (path.startsWith('http')) {
    // Our own backend origin → strip to a same-origin relative path.
    if (backendUrl && path.startsWith(`${backendUrl}/`)) {
      return path.slice(backendUrl.length);
    }
    // Any absolute URL to our own /uploads (e.g. localhost variants) → relative.
    try {
      const u = new URL(path);
      if (u.pathname.startsWith('/uploads/')) return `${u.pathname}${u.search}`;
    } catch {
      /* not a parseable URL — fall through */
    }
    return path; // genuine external URL (cloud storage) — leave absolute
  }
  return path.startsWith('/') ? path : `/${path}`;
}
