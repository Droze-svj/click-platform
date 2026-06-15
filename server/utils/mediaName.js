// Unguessable media object names.
//
// Private user media (uploaded videos, music, exports) is served from the public
// `/uploads` static mount as a capability URL — so the file NAME is the only
// thing protecting it. The old scheme `${userId}-${Date.now()}-${Math.random()*1e9}`
// failed that on two counts: it embeds the owner's id (so a leaked URL reveals
// whose media it is AND lets a tenant be enumerated) and uses non-cryptographic
// Math.random. These helpers produce a crypto-random token instead, so a leaked
// URL can't be turned into another of the victim's objects.
//
// NOTE: this makes the capability URL unguessable, but the object is still
// anonymously fetchable by anyone who OBSERVES the URL. Truly-private media
// should additionally be served only through an authed, ownership-checked route
// (see routes/video/render.js) — a frontend-coordinated follow-up.

const crypto = require('crypto');
const path = require('path');

function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

// e.g. randomMediaName('.mp4') -> '9f1c…3a.mp4'
function randomMediaName(ext = '') {
  const e = ext ? (ext.startsWith('.') ? ext : `.${ext}`) : '';
  return `${randomToken(16)}${e.toLowerCase()}`;
}

// Keep only the extension from a client-supplied original name; random base.
function randomMediaNameFrom(originalName, fallbackExt = '') {
  const ext = path.extname(String(originalName || '')) || fallbackExt;
  return randomMediaName(ext);
}

module.exports = { randomToken, randomMediaName, randomMediaNameFrom };
