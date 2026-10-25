// passwordCompat — compare a password against a bcrypt hash, accepting the
// HTML-escaped form some existing hashes were made from.
//
// From 2026-06-09 to 2026-10-24 the global input sanitizer HTML-escaped every
// request body string, passwords included, before the route hashed it. So a
// password typed as `a&b/c'd` was stored as the hash of `a&amp;b&#x2F;c&#x27;d`.
// Input is no longer escaped; this keeps those accounts signing in, and callers
// re-hash the plain password on a legacy match so it stops being needed.

const bcrypt = require('bcryptjs');
const { escape: htmlEscape } = require('validator');

/** @returns {Promise<{ match: boolean, legacy: boolean }>} */
async function comparePasswordCompat(candidate, hash) {
  if (typeof candidate !== 'string' || !hash) return { match: false, legacy: false };
  if (await bcrypt.compare(candidate, hash)) return { match: true, legacy: false };
  // The sanitizer trimmed too, so the stored form is escape(trim(input)).
  const escaped = htmlEscape(candidate.trim());
  if (escaped !== candidate && await bcrypt.compare(escaped, hash)) return { match: true, legacy: true };
  return { match: false, legacy: false };
}

module.exports = { comparePasswordCompat };
