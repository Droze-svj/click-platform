// Gate the public /uploads static mount behind a valid signed-capability URL.
//
// Now ON by default (set REQUIRE_SIGNED_MEDIA=false to disable). The API already
// signs every /uploads URL in its JSON responses at one global point
// (server/index.js res.json → signMediaUrls), so the client only ever receives
// signable URLs. A request to /uploads/<path> must carry a valid ?exp&sig minted
// by utils/mediaUrlSigner — otherwise 403. A small allowlist of truly-public
// prefixes (assets referenced outside API responses, e.g. fonts in CSS) bypasses
// the check. See docs/security/private-media-access-plan.md.

const { verifyMediaUrl } = require('../utils/mediaUrlSigner');

function enforcementEnabled() {
  return String(process.env.REQUIRE_SIGNED_MEDIA || '').toLowerCase() !== 'false';
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
