// One source of truth for every OAuth provider's redirect_uri.
//
// OAuth 2.0 requires that the redirect_uri sent when ASKING for an
// authorization code and the one sent when EXCHANGING that code are identical —
// byte for byte. Providers reject a mismatch outright (`redirect_uri_mismatch`),
// which surfaces to the user as "connecting your account failed" with nothing
// useful in the UI.
//
// Click derived the two independently, and they disagreed:
//
//   authorize  routes/oauth/<p>.js   →  <P>_CALLBACK_URL  ||  the request's own host
//   exchange   services/<p>OAuth…    →  <P>_REDIRECT_URI  ||  API_URL || BACKEND_URL
//                                       || FRONTEND_URL  || 'http://localhost:5001'
//
// Six providers, six slightly different chains, and the exchange never saw the
// URL the authorize step had actually used. render.yaml sets none of those
// variables, so on the documented deployment the authorize step used the real
// Render host while the exchange sent `http://localhost:5001/api/oauth/<p>/callback`.
// Connecting ANY social account failed in production unless an operator happened
// to set two differently-named variables to the same value.
//
// Fix: both steps call resolveOAuthCallbackUrl(), and the callback route hands
// the resolved value to the exchange so the two cannot drift again.
//
// Precedence, deliberately:
//   1. <P>_CALLBACK_URL / <P>_REDIRECT_URI — an operator's explicit value always
//      wins, and both historical spellings are accepted so existing deployments
//      keep working whichever one they set.
//   2. API_URL / BACKEND_URL — the API's own origin.
//   3. The incoming request's host, which is correct by construction: the
//      provider redirects back to the host that sent them.
//   4. localhost:5001, for local dev.
//
// FRONTEND_URL is NOT in the chain. The callback route lives on the API, and
// Facebook and Twitter reaching for the frontend origin (port 3000) was part of
// how the two steps came to disagree.

const PROVIDER_ENV_NAMES = {
  tiktok: ['TIKTOK_CALLBACK_URL', 'TIKTOK_REDIRECT_URI'],
  youtube: ['YOUTUBE_CALLBACK_URL', 'YOUTUBE_REDIRECT_URI'],
  twitter: ['TWITTER_CALLBACK_URL', 'TWITTER_REDIRECT_URI'],
  facebook: ['FACEBOOK_CALLBACK_URL', 'FACEBOOK_REDIRECT_URI'],
  linkedin: ['LINKEDIN_CALLBACK_URL', 'LINKEDIN_REDIRECT_URI'],
  instagram: ['INSTAGRAM_CALLBACK_URL', 'INSTAGRAM_REDIRECT_URI'],
  google: ['GOOGLE_CALLBACK_URL', 'GOOGLE_REDIRECT_URI'],
};

/**
 * The origin the API is reachable on.
 *
 * A trailing `/api` is stripped: API_URL is written both ways across this repo
 * (the client treats it as including `/api`, the server as not), and appending
 * `/api/oauth/...` to a value that already ends in `/api` yields `/api/api/...`
 * — a redirect_uri that matches nothing.
 */
function apiOrigin(req) {
  const explicit = process.env.API_URL || process.env.BACKEND_URL;
  if (explicit) {
    return String(explicit).trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  }

  if (req && typeof req.get === 'function') {
    // Behind Render's proxy the forwarded headers carry the public origin;
    // req.protocol is only trustworthy once trust proxy is set, so prefer them.
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) {
      const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http')
        .split(',')[0]
        .trim();
      return `${proto}://${host}`;
    }
  }

  return 'http://localhost:5001';
}

/**
 * Resolve the redirect_uri for a provider.
 *
 * @param {string} provider  'tiktok' | 'youtube' | 'twitter' | 'facebook' | 'linkedin' | 'instagram' | 'google'
 * @param {import('express').Request} [req]  the current request, when there is
 *        one. Both the authorize and the callback route have one, and both hit
 *        the same host, so including it is safe and makes the no-env-set case
 *        work instead of silently pointing at localhost.
 * @returns {string} absolute callback URL
 */
function resolveOAuthCallbackUrl(provider, req) {
  const names = PROVIDER_ENV_NAMES[provider];
  if (!names) throw new Error(`Unknown OAuth provider: ${provider}`);

  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }

  return `${apiOrigin(req)}/api/oauth/${provider}/callback`;
}

module.exports = { resolveOAuthCallbackUrl, apiOrigin, PROVIDER_ENV_NAMES };
