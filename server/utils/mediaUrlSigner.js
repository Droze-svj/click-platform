// Signed capability URLs for private /uploads media.
//
// The /uploads tree is served by express.static with no auth, and the app is
// Bearer-only (no cookies), so <img>/<video src> can't carry a token. The fix is
// to make each private media URL a short-lived HMAC-signed capability: the API
// signs the URLs it returns, and requireSignedMedia verifies the signature before
// express.static serves the bytes. See docs/security/private-media-access-plan.md.
//
// Stateless (no DB lookup) and works for EXISTING files too — any path can be
// signed, so old predictable-named files are protected without a rename migration.

const crypto = require('crypto');
const { getJwtSecret } = require('./jwtSecret');

const DEFAULT_TTL_SEC = parseInt(process.env.MEDIA_URL_TTL_SEC || String(24 * 60 * 60), 10); // 24h

// Dedicated secret if set, else the JWT secret (so it works out of the box).
function secret() {
  return process.env.MEDIA_URL_SECRET || getJwtSecret();
}

// Canonicalize a path or full URL to the "/uploads/..." pathname we sign:
// strip scheme+host, strip query/hash. Filenames are case-sensitive, so no
// case-folding. Returns '' for anything not under /uploads.
function normalizeUploadsPath(pathOrUrl) {
  let p = String(pathOrUrl == null ? '' : pathOrUrl);
  const m = p.match(/^[a-z]+:\/\/[^/]+(\/.*)$/i); // absolute URL → keep pathname
  if (m) p = m[1];
  p = p.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  return p.startsWith('/uploads/') ? p : '';
}

function computeSig(uploadsPath, exp) {
  return crypto.createHmac('sha256', secret()).update(`${uploadsPath}\n${exp}`).digest('hex');
}

/**
 * Sign a media URL/path. Returns the input UNCHANGED when it isn't an /uploads
 * path (external URLs, data: URIs, already-absolute CDN links pass through), so
 * callers can sign indiscriminately. Appends `?exp=<unixSec>&sig=<hex>`.
 */
function signMediaUrl(pathOrUrl, ttlSec = DEFAULT_TTL_SEC) {
  const p = normalizeUploadsPath(pathOrUrl);
  if (!p) return pathOrUrl;
  const exp = Math.floor(Date.now() / 1000) + Math.max(1, ttlSec);
  const sig = computeSig(p, exp);
  return `${p}?exp=${exp}&sig=${sig}`;
}

/**
 * Verify a signature for an /uploads path. `pathOrUrl` is the path that was
 * signed (the verifier reconstructs it from the request). Constant-time compare,
 * rejects missing/expired/malformed.
 */
function verifyMediaUrl(pathOrUrl, exp, sig) {
  const p = normalizeUploadsPath(pathOrUrl);
  if (!p || !sig || typeof sig !== 'string') return false;
  const expNum = parseInt(exp, 10);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = computeSig(p, expNum);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { signMediaUrl, verifyMediaUrl, normalizeUploadsPath, DEFAULT_TTL_SEC };
