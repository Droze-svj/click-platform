// Signed OAuth `state` — stateless CSRF protection for OAuth callbacks.
//
// The OAuth flow round-trips a `state` blob through the provider and back. We
// embed the userId (and PKCE codeVerifier for Twitter) in it, so the callback
// MUST be able to trust that payload. Previously `state` was an UNSIGNED base64
// JSON blob, so anyone could forge `state` with an arbitrary userId and the
// callback would link the OAuth account to that user (login-CSRF / account
// injection).
//
// Fix: HMAC-sign the payload. `state = base64url(payload).base64url(hmac)`. The
// callback verifies the signature (timing-safe) before trusting anything, and
// enforces a 10-minute age limit (replay window). Stateless → works across
// multiple server instances without shared storage, and carries the PKCE
// verifier that an in-memory store couldn't.

const crypto = require('crypto');
const { getJwtSecret } = require('./jwtSecret');

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function stateSecret() {
  // Dedicated secret if provided, else reuse the JWT secret (which is required
  // in production via getJwtSecret()).
  return process.env.OAUTH_STATE_SECRET || getJwtSecret();
}

/**
 * Sign a state payload. Returns `base64url(json).base64url(hmac)`.
 * @param {Object} payload - e.g. { userId, platform, redirectUri, codeVerifier }
 */
function signState(payload) {
  const body = Buffer
    .from(JSON.stringify({ ...payload, _iat: Date.now() }))
    .toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a signed state and return its payload, or null when the signature is
 * missing/invalid/expired. Never throws.
 * @param {string} state
 * @param {Object} [opts] - { maxAgeMs }
 */
function verifyState(state, opts = {}) {
  if (!state || typeof state !== 'string') return null;
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const maxAge = typeof opts.maxAgeMs === 'number' ? opts.maxAgeMs : DEFAULT_TTL_MS;
  if (payload._iat && (Date.now() - payload._iat) > maxAge) return null; // expired

  return payload;
}

module.exports = { signState, verifyState };
