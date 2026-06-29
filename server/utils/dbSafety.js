// dbSafety — ONE source of truth for "is this Mongo URI the remote/prod DB, and
// am I allowed to touch it?". Used by:
//   - server/config/database.js  (refuse a non-prod *boot* from hitting Atlas)
//   - tests/*                     (refuse a test run from hitting Atlas)
//   - scripts/*, server/scripts/* (refuse a non-prod *script* from hitting Atlas)
//
// Background: .env holds the LIVE production Atlas URI (click_v3). dotenv loads it
// into process.env.MONGODB_URI for ANY process started in this repo — a dev boot,
// a test run, or a one-off maintenance script. Without a guard, each of those
// silently connects to prod; a stray deleteMany() then wipes live data (this has
// happened). These helpers fail-CLOSED so that only an explicitly-production
// process ever connects to the production database.

/** True when a MongoDB URI points at a remote/Atlas (i.e. PRODUCTION) host. */
const isRemoteProdUri = (uri) =>
  /mongodb\+srv:/i.test(uri || '') || /\.mongodb\.net/i.test(uri || '');

/** Redact credentials from a URI for safe logging. */
const redactUri = (uri) => String(uri || '').replace(/\/\/[^@]*@/, '//***@');

/**
 * Guard for STANDALONE scripts (scripts/*.js, server/scripts/*.js).
 *
 * Refuses to let a non-production process connect to a remote/Atlas database and
 * THROWS (fail-fast) instead of silently falling back — an operator who believes
 * they are hitting a local DB must never silently mutate prod.
 *
 * To intentionally target prod from a script (e.g. a vetted migration), set
 * NODE_ENV=production OR pass `allowProd: true` (typically wired to an explicit
 * `--prod` / `--confirm-prod` CLI flag that the script's own dry-run gating sits
 * behind).
 *
 * @param {string} uri - the candidate MONGODB_URI
 * @param {object} [opts]
 * @param {boolean} [opts.allowProd=false] - explicit opt-in to a prod connection
 * @param {string}  [opts.scriptName='script'] - for the error message
 * @returns {string} the same uri (so callers can do `connect(assertSafeScriptDbUri(uri))`)
 */
function assertSafeScriptDbUri(uri, opts = {}) {
  const { allowProd = false, scriptName = 'script' } = opts;
  const isProd = process.env.NODE_ENV === 'production';
  if (isRemoteProdUri(uri) && !isProd && !allowProd) {
    throw new Error(
      `[db-safety] ${scriptName}: refusing to connect to a REMOTE/Atlas database ` +
      `(${redactUri(uri)}) while NODE_ENV=${process.env.NODE_ENV || '(unset)'}. ` +
      `This protects production data from a script you likely meant to run against ` +
      `a local DB. To target prod intentionally, run with NODE_ENV=production ` +
      `(and an explicit --prod/--confirm-prod flag where the script supports one).`
    );
  }
  return uri;
}

module.exports = { isRemoteProdUri, redactUri, assertSafeScriptDbUri };
