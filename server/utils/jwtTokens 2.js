/**
 * Token-pair issuance — single source of truth.
 *
 * Every login/register/oauth path that hands a session to the user should
 * call `issueTokenPair(userId)` instead of inlining `jwt.sign(...)`. The
 * pair is a short-lived access token (used as the Bearer) plus a longer
 * refresh token (used to mint new access tokens without re-authenticating).
 *
 * Migration note (2026-05): we are intentionally keeping the access token
 * at 30 days for this rollout. Existing clients without a refresh token
 * stay valid until their token expires. New clients get a refresh token
 * pair so a future change to drop access to 1h becomes a one-line edit
 * (ACCESS_TTL → '1h') instead of a coordinated client+server rollout.
 *
 * The refresh endpoint at server/routes/auth.js:/refresh accepts the
 * refresh token (type='refresh') and returns a fresh pair.
 */

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./jwtSecret');

// Access-token lifetime. Drop to '1h' once the client-side refresh loop
// is proven in production and every session has a refresh token alongside.
const ACCESS_TTL = '30d';
// Refresh-token lifetime — long enough that a casually-used account stays
// logged in for a quarter, short enough that an exfiltrated refresh token
// can't grant new access forever.
const REFRESH_TTL = '90d';

function getRefreshSecret() {
  // Use a dedicated refresh secret if provided; otherwise fall back to the
  // access secret so single-key deployments still work. (The refresh token
  // is distinguished by its `type: 'refresh'` claim, not by the key, so
  // mixing keys is a defense-in-depth nicety, not a correctness req.)
  return process.env.JWT_REFRESH_SECRET || getJwtSecret();
}

/**
 * Sign a fresh (access, refresh) token pair for `userId`.
 *
 * @param {string} userId — the user's canonical id (Mongoose ObjectId
 *                          stringified, Supabase UUID, or dev-id).
 * @returns {{ token: string, refreshToken: string, expiresIn: number }}
 *          `token` is the access token (Bearer), `refreshToken` is the
 *          long-lived token, `expiresIn` is the access lifetime in seconds.
 */
function issueTokenPair(userId) {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    getRefreshSecret(),
    { expiresIn: REFRESH_TTL }
  );
  return {
    token,
    refreshToken,
    // 30d in seconds, kept in sync with ACCESS_TTL above. Used by the
    // client to schedule a proactive refresh before expiry.
    expiresIn: 30 * 24 * 60 * 60,
  };
}

module.exports = { issueTokenPair, ACCESS_TTL, REFRESH_TTL };
