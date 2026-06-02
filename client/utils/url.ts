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
