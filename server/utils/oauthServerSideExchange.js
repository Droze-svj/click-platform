// Feature-flagged server-side OAuth code exchange (security hardening).
//
// By default the google/facebook/linkedin callbacks redirect the single-use
// authorization `code` to the frontend in the URL query string — so it lands in
// browser history / the Referer header. When OAUTH_SERVER_SIDE_EXCHANGE=true the
// callback instead exchanges the code SERVER-SIDE and redirects with only a
// success flag (the pattern the Twitter flow already uses), so the code never
// touches the browser URL.
//
// The provider callback carries no session, so we carry the userId in the OAuth
// `state`: at /authorize we replace the provider URL's state with an HMAC-signed
// blob embedding { userId, platform, s: <the service's own inner state nonce> }.
// The provider echoes it back; the callback verifies it (CSRF-safe — can't be
// forged or carry another user's id) to recover userId + the inner nonce, then
// calls the service's existing exchangeCodeForToken(userId, code, innerState),
// whose own nonce check is unchanged. Flag OFF → byte-identical legacy behavior.
//
// STAGING TEST PLAN:
//   1. Deploy with OAUTH_SERVER_SIDE_EXCHANGE unset → confirm google/fb/linkedin
//      connect exactly as today (code still in the redirect, /complete works).
//   2. Set OAUTH_SERVER_SIDE_EXCHANGE=true, re-connect each platform with a real
//      provider account. Verify: (a) the post-consent redirect URL is
//      `/dashboard/social?connected=<platform>&success=true` with NO `code=` /
//      `state=` params, (b) the SocialConnection is created, (c) an expired/
//      tampered state shows the error redirect. Watch for provider state-length
//      limits (the signed state is longer than a bare nonce).
//   3. Roll out per-platform; keep the flag off for tiktok/youtube/instagram
//      until their exchangeCodeForToken signatures are normalized to
//      (userId, code, state).

const { signState, verifyState } = require('./oauthState');

function serverSideExchangeEnabled() {
  return String(process.env.OAUTH_SERVER_SIDE_EXCHANGE || '').toLowerCase() === 'true';
}

// Swap the provider auth URL's `state` param for an HMAC-signed blob that embeds
// the userId + the service's inner state nonce. Returns the rewritten URL.
function wrapAuthorizeUrl(url, userId, platform) {
  const u = new URL(url);
  const innerState = u.searchParams.get('state') || '';
  const outer = signState({ userId: String(userId), platform, s: innerState, ssx: 1 });
  u.searchParams.set('state', outer);
  return u.toString();
}

// Verify the echoed outer state and recover { userId, innerState }, or null when
// the signature/expiry/marker check fails.
function unwrapCallbackState(outerState) {
  const decoded = verifyState(String(outerState || ''));
  if (!decoded || decoded.ssx !== 1 || !decoded.userId) return null;
  return { userId: decoded.userId, innerState: decoded.s || '' };
}

module.exports = { serverSideExchangeEnabled, wrapAuthorizeUrl, unwrapCallbackState };
