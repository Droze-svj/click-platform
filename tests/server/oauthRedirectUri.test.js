// OAuth 2.0 requires the redirect_uri sent when ASKING for an authorization code
// and the one sent when EXCHANGING it to be identical. Providers reject a
// mismatch, and the user just sees "connecting your account failed".
//
// Click derived the two independently and they disagreed:
//
//   authorize  routes/oauth/<p>.js  → <P>_CALLBACK_URL || the request's host
//   exchange   services/<p>OAuth…   → <P>_REDIRECT_URI || API_URL || BACKEND_URL
//                                     || FRONTEND_URL || 'http://localhost:5001'
//
// render.yaml sets none of those, so in the documented deployment the authorize
// step used the real host while the exchange sent localhost:5001 — connecting
// any social account failed in production.
//
// Both sides now go through utils/oauthCallbackUrl. These tests pin the two
// properties that make that safe: one resolver, and no service reintroducing a
// private derivation.

const fs = require('fs');
const path = require('path');
const { resolveOAuthCallbackUrl, PROVIDER_ENV_NAMES } = require('../../server/utils/oauthCallbackUrl');

const PROVIDERS = Object.keys(PROVIDER_ENV_NAMES);

// A minimal Express-request stand-in: only `get` and `protocol` are read.
const fakeReq = (headers = {}, protocol = 'https') => ({
  protocol,
  get: (name) => headers[String(name).toLowerCase()],
});

describe('resolveOAuthCallbackUrl', () => {
  const saved = {};
  const ENV_KEYS = [
    'API_URL', 'BACKEND_URL', 'FRONTEND_URL',
    ...Object.values(PROVIDER_ENV_NAMES).flat(),
  ];

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  test.each(PROVIDERS)('%s: authorize and exchange resolve identically', (provider) => {
    // The two call sites differ only in which request object they hold, and both
    // requests hit the same host — so the resolved values must be equal.
    const authorizeReq = fakeReq({ host: 'click.example.com' });
    const callbackReq = fakeReq({ host: 'click.example.com' });

    expect(resolveOAuthCallbackUrl(provider, authorizeReq))
      .toBe(resolveOAuthCallbackUrl(provider, callbackReq));
  });

  test.each(PROVIDERS)('%s: with no env set, uses the request host, NOT localhost', (provider) => {
    // This is the exact production case: render.yaml sets none of these.
    const url = resolveOAuthCallbackUrl(provider, fakeReq({ host: 'click.onrender.com' }));
    expect(url).toBe(`https://click.onrender.com/api/oauth/${provider}/callback`);
    expect(url).not.toMatch(/localhost/);
  });

  test.each(PROVIDERS)('%s: an explicit env value wins over everything', (provider) => {
    const [callbackName, redirectName] = PROVIDER_ENV_NAMES[provider];
    process.env.API_URL = 'https://ignored.example.com';

    process.env[callbackName] = 'https://explicit.example.com/cb';
    expect(resolveOAuthCallbackUrl(provider, fakeReq({ host: 'h' }))).toBe('https://explicit.example.com/cb');

    // Both historical spellings are honoured, so a deployment that set only the
    // _REDIRECT_URI form keeps working.
    delete process.env[callbackName];
    process.env[redirectName] = 'https://legacy.example.com/cb';
    expect(resolveOAuthCallbackUrl(provider, fakeReq({ host: 'h' }))).toBe('https://legacy.example.com/cb');
  });

  test('a trailing /api on API_URL is not doubled', () => {
    // API_URL is written both ways in this repo. Appending /api/oauth/... to a
    // value already ending in /api yields /api/api/... — matching nothing.
    process.env.API_URL = 'https://api.example.com/api';
    expect(resolveOAuthCallbackUrl('tiktok')).toBe('https://api.example.com/api/oauth/tiktok/callback');
  });

  test('forwarded headers win, so the proxied origin is used', () => {
    const req = fakeReq(
      { host: 'internal:5001', 'x-forwarded-host': 'click.example.com', 'x-forwarded-proto': 'https' },
      'http'
    );
    expect(resolveOAuthCallbackUrl('google', req)).toBe('https://click.example.com/api/oauth/google/callback');
  });

  test('FRONTEND_URL is never used — the callback route lives on the API', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(resolveOAuthCallbackUrl('facebook', fakeReq({ host: 'api.example.com' })))
      .toBe('https://api.example.com/api/oauth/facebook/callback');
  });

  test('an unknown provider is a programming error, not a silent default', () => {
    expect(() => resolveOAuthCallbackUrl('myspace')).toThrow(/Unknown OAuth provider/);
  });
});

describe('no OAuth service derives its own redirect_uri', () => {
  const SERVICES = [
    'tiktokOAuthService', 'youtubeOAuthService', 'twitterOAuthService',
    'facebookOAuthService', 'linkedinOAuthService', 'instagramOAuthService',
    'googleOAuthService',
  ];

  test.each(SERVICES)('%s builds its default from the shared resolver', (name) => {
    const src = fs.readFileSync(path.join(__dirname, `../../server/services/${name}.js`), 'utf8');

    // A private fallback chain is how the drift happened in the first place.
    // If this fails, route the new derivation through resolveOAuthCallbackUrl.
    expect(src).toMatch(/resolveOAuthCallbackUrl\(/);
    expect(src).not.toMatch(/process\.env\.FRONTEND_URL[^\n]*oauth/);
  });

  test.each(SERVICES)('%s exchange accepts a caller-supplied callbackUrl', (name) => {
    const src = fs.readFileSync(path.join(__dirname, `../../server/services/${name}.js`), 'utf8');
    const hasExchange = /exchangeCodeForToken\s*\(/.test(src);
    if (!hasExchange) return; // instagram connects via Facebook; no exchange of its own

    // The parameter is the whole point: without it the exchange falls back to a
    // default that the authorize step may not have used.
    expect(src).toMatch(/exchangeCodeForToken\([^)]*callbackUrl/);
  });
});
