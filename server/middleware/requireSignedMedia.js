// Gate the public /uploads static mount behind a valid signed-capability URL.
//
// Flag-gated by REQUIRE_SIGNED_MEDIA (default OFF → current behavior, zero risk
// until the API signs the media URLs it returns and the frontend is verified).
// When ON, a request to /uploads/<path> must carry a valid ?exp&sig minted by
// utils/mediaUrlSigner (see signMediaUrl) — otherwise 403. A small allowlist of
// truly-public prefixes (assets referenced outside API responses, e.g. fonts in
// CSS) bypasses the check. See docs/security/private-media-access-plan.md.

const { verifyMediaUrl } = require('../utils/mediaUrlSigner');

function enforcementEnabled() {
  return String(process.env.REQUIRE_SIGNED_MEDIA || '').toLowerCase() === 'true';
}

// Public prefixes relative to /uploads/ (no leading slash). Default: fonts only.
// Configure with PUBLIC_MEDIA_PREFIXES="fonts/,thumbnails/" etc.
function publicPrefixes() {
  const raw = process.env.PUBLIC_MEDIA_PREFIXES;
  const list = raw ? raw.split(',') : ['fonts/'];
  return list.map((s) => s.trim().replace(/^\/+/, '')).filter(Boolean);
}

function requireSignedMedia(req, res, next) {
  if (!enforcementEnabled()) return next(); // flag off → serve as today

  // Mounted at /uploads, so req.path is the path after the mount, e.g. /videos/x.
  const rel = String(req.path || '').replace(/^\/+/, '');
  if (publicPrefixes().some((p) => rel.startsWith(p))) return next();

  // Reconstruct the exact path that was signed: <baseUrl>/<rel> = /uploads/...
  const signedPath = `${req.baseUrl || '/uploads'}${req.path || ''}`;
  const { exp, sig } = req.query || {};
  if (verifyMediaUrl(signedPath, exp, sig)) return next();

  return res.status(403).json({ success: false, error: 'Forbidden: media URL is unsigned or expired' });
}

module.exports = requireSignedMedia;
module.exports.enforcementEnabled = enforcementEnabled;
