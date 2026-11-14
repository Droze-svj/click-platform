/**
 * Turn a media reference into a URL a social platform can fetch from the public
 * internet. Meta (Instagram/Facebook) downloads the video itself, so it needs an
 * absolute URL, and our own /uploads files are private behind signed links.
 *
 *   /uploads/clips/a.mp4          → https://<app>/uploads/clips/a.mp4?exp=…&sig=…
 *   https://<app>/uploads/a.mp4   → same, re-signed
 *   https://cdn.example.com/a.mp4 → unchanged
 */
const { signMediaUrl, normalizeUploadsPath } = require('./mediaUrlSigner');

// Long enough for Meta to fetch and process a large reel; short enough that a
// leaked link stops working the same day.
const PLATFORM_FETCH_TTL_SEC = 6 * 60 * 60;

function appOrigin() {
  const raw = process.env.APP_URL || process.env.API_URL || process.env.FRONTEND_URL || '';
  return String(raw).trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function publicMediaUrl(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl;
  const uploadsPath = normalizeUploadsPath(mediaUrl);
  if (!uploadsPath) return mediaUrl; // external URL — leave as is
  const origin = appOrigin();
  if (!origin) {
    throw new Error('APP_URL is not set, so Instagram/Facebook cannot fetch this video. Set APP_URL to the public site address.');
  }
  return `${origin}${signMediaUrl(uploadsPath, PLATFORM_FETCH_TTL_SEC)}`;
}

module.exports = { publicMediaUrl, PLATFORM_FETCH_TTL_SEC };
