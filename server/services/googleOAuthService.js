// Google OAuth Service
// Features: token refresh, state validation, Supabase storage, ID token decode, profile fetch.

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { safeJsonParse } = require('../utils/safeJson');
const { createClient } = require('@supabase/supabase-js');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
// Default scope covers the four product surfaces Click reads:
//   - openid/email/profile: identity for login + display name
//   - youtube.readonly: list user's channels, video metadata, basic stats
//   - yt-analytics.readonly: views/watch-time/retention via YouTube Analytics API v2
//   - webmasters.readonly: Search Console queries, impressions, CTR
// Override via GOOGLE_SCOPE for installs that want a narrower set.
const DEFAULT_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ');
const LOG_CONTEXT = { service: 'google-oauth' };

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    logger.info('Supabase client initialized in Google OAuth service');
  }
  return supabase;
}

/**
 * Resolve the Google OAuth client id. Falls back to `YOUTUBE_CLIENT_ID`
 * when `GOOGLE_CLIENT_ID` is unset — they're the same credentials in
 * practice (same Google Cloud project owns the YouTube Data, YouTube
 * Analytics, Search Console, and basic profile APIs), so a deployment
 * that already wired YouTube creds shouldn't need to duplicate them.
 * Same fallback applies to the client secret + callback URL.
 */
function getGoogleClientId()      { return process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || null; }
function getGoogleClientSecret()  { return process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || null; }
function getGoogleCallbackUrl()   { return process.env.GOOGLE_CALLBACK_URL || process.env.YOUTUBE_CALLBACK_URL || null; }

function isConfigured() {
  return !!(getGoogleClientId() && getGoogleClientSecret());
}

function defaultRedirectUri() {
  return getGoogleCallbackUrl()
    || `${process.env.FRONTEND_URL || process.env.API_URL || 'http://localhost:5001'}/api/oauth/google/callback`;
}

function getScope() {
  const s = process.env.GOOGLE_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

/**
 * Build the Google OAuth authorization URL.
 *
 * Signature aligned with every other platform service: `(userId, state,
 * callbackUrl)`. The unified `/api/oauth/:platform/connect` route in
 * `server/routes/oauth.js` already generates a base64-encoded state
 * payload — we accept that as-is. When called with only two args
 * (`getAuthorizationUrl(userId, callbackUrl)`) we treat the second arg
 * as the callback URL and synthesize our own state, preserving the
 * older calling convention for any direct callers.
 */
async function getAuthorizationUrl(userId, stateOrCallbackUrl, maybeCallbackUrl) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  if (!userId) throw new Error('userId is required');

  // Argument disambiguation. The route always passes 3 args
  // (`userId, state, callbackUrl`). Direct legacy callers pass 2
  // (`userId, callbackUrl`). State is hex-ish or base64-ish — never a
  // URL — so we sniff for a `://` to tell them apart.
  let state;
  let callbackUrl;
  if (typeof maybeCallbackUrl === 'string' && maybeCallbackUrl.length > 0) {
    state = stateOrCallbackUrl;
    callbackUrl = maybeCallbackUrl;
  } else if (typeof stateOrCallbackUrl === 'string' && stateOrCallbackUrl.includes('://')) {
    // Legacy two-arg call: synthesize a hex state ourselves.
    state = crypto.randomBytes(32).toString('hex');
    callbackUrl = stateOrCallbackUrl;
  } else {
    throw new Error('callbackUrl is required');
  }

  const scope = getScope();
  const clientId = getGoogleClientId();
  // Google's OAuth 2.0 v2 endpoint. The previous URL
  // (`/oauth/authorize`) does not exist on accounts.google.com — every
  // connect attempt returned 404 from Google before the consent screen
  // could render. The correct endpoint is documented at
  // https://developers.google.com/identity/protocols/oauth2/web-server.
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code&` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(callbackUrl.trim())}&` +
    `state=${encodeURIComponent(state)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    // `include_granted_scopes=true` lets Google add YouTube + Search
    // Console scopes on top of an existing grant (e.g. a returning user
    // who originally connected only for "openid email profile") without
    // forcing them to re-authorise the base scopes.
    `include_granted_scopes=true&` +
    `access_type=offline&` +
    `prompt=consent`;

  const supabase = getSupabaseClient();
  const { data: currentUser, error: fetchErr } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  if (fetchErr) {
    logger.error('Google OAuth state storage fetch error', { ...LOG_CONTEXT, userId, error: fetchErr.message });
    throw new Error(`Failed to store OAuth state: ${fetchErr.message}`);
  }

  const socialLinks = currentUser?.social_links || {};
  const oauthData = socialLinks.oauth || {};
  const googleData = oauthData.google || {};

  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthData,
          google: { ...googleData, state },
        },
      },
    })
    .eq('id', userId);

  if (updateError) {
    logger.error('Google OAuth state storage update error', { ...LOG_CONTEXT, userId, error: updateError.message });
    throw new Error(`Failed to store OAuth state: ${updateError.message}`);
  }

  logger.info('Google OAuth authorization URL generated', { ...LOG_CONTEXT, userId });
  return { url: authUrl, state };
}

async function exchangeCodeForToken(userId, code, state) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  if (!userId || !code || !state) throw new Error('userId, code, and state are required');

  const supabase = getSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauthData = user?.social_links?.oauth || {};
  const googleData = oauthData.google || {};

  if (userError || !user || !googleData.state || googleData.state !== state) {
    logger.warn('Google OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
    throw new Error('Invalid OAuth state');
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const redirectUri = defaultRedirectUri();

  // Google's token endpoint expects form-urlencoded params in the
  // request BODY, not the URL query string.
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  // Diagnostic: dump exactly what we're sending Google (with secrets
  // masked) so the next failure log makes the cause obvious.
  logger.info('Google token exchange request', {
    ...LOG_CONTEXT,
    tokenUrl: TOKEN_URL,
    codeFirstChars: (code || '').slice(0, 12),
    codeLength: (code || '').length,
    codeContainsSlash: (code || '').includes('/'),
    codeContainsPlus: (code || '').includes('+'),
    codeContainsSpace: (code || '').includes(' '),
    redirectUri,
    clientIdTail: (clientId || '').slice(-30),
    bodyLength: body.toString().length,
  });

  let response;
  try {
    response = await axios.post(
      TOKEN_URL,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (axiosErr) {
    // Capture Google's response body in full — the wrapper around
    // axios errors elsewhere only surfaces error_description. The full
    // body often includes a more specific reason for "Malformed auth
    // code." (e.g. "invalid_grant" with a particular sub-reason).
    logger.error('Google token exchange axios error', {
      ...LOG_CONTEXT,
      status: axiosErr?.response?.status,
      data: axiosErr?.response?.data,
      message: axiosErr?.message,
    });
    throw axiosErr;
  }

  const { access_token, expires_in, refresh_token, id_token } = response.data;
  if (!access_token) throw new Error('Google did not return an access token');

  if (!id_token || typeof id_token !== 'string' || id_token.split('.').length < 2) {
    throw new Error('Google did not return a valid id_token');
  }
  const userInfo = safeJsonParse(Buffer.from(id_token.split('.')[1], 'base64').toString(), null);
  if (!userInfo) {
    throw new Error('Google returned a malformed id_token payload');
  }
  const profileResponse = await axios.get(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profileData = profileResponse.data;

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  // Route through the unified credential store so Google sits in the same
  // accounts[] shape as the other 6 platforms. This is what gives us
  // multi-account ("connect a second Google account") for free, and what
  // makes /api/oauth/connections agree with /api/oauth/google/status.
  // The previous flat-shape write (top-level accessToken/refreshToken with
  // connected: true) bypassed accounts[] entirely.
  const oauthService = require('./oauthService');
  await oauthService.saveSocialCredentials(userId, 'google', {
    accessToken: access_token,
    refreshToken: refresh_token || null,
    platformUserId: userInfo.sub,
    extra: {
      platformUserId: userInfo.sub,
      platformUsername: profileData.name,
      avatar: profileData.picture || null,
      email: profileData.email,
      expiresAt,
    },
  });

  logger.info('Google OAuth token exchange successful', { ...LOG_CONTEXT, userId });
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    userInfo: {
      id: userInfo.sub,
      name: profileData.name,
      email: profileData.email,
      picture: profileData.picture,
    },
  };
}

function isTokenExpiredSoon(expiresAt) {
  if (!expiresAt) return false;
  return new Date() >= new Date(expiresAt);
}

/**
 * Read the active Google credential for a user. `accountId` selects a
 * specific linked Google account; default is the active/primary one.
 * Routes through the same accounts[] reader every other platform uses.
 */
async function getGoogleClient(userId, accountId = null) {
  if (!userId) throw new Error('userId is required');
  const oauthService = require('./oauthService');
  const creds = await oauthService.getSocialCredentials(userId, 'google', accountId);
  if (!creds || !creds.accessToken) {
    throw new Error('Google account not connected');
  }
  if (isTokenExpiredSoon(creds.expiresAt)) {
    if (creds.refreshToken) {
      return await refreshAccessToken(userId, creds.accountId || accountId);
    }
    throw new Error('Google token expired. Please reconnect your account.');
  }
  return creds.accessToken;
}

async function refreshAccessToken(userId, accountId = null) {
  if (!userId) throw new Error('userId is required');
  const oauthService = require('./oauthService');
  const creds = await oauthService.getSocialCredentials(userId, 'google', accountId);
  if (!creds || !creds.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your Google account.');
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  // Form-urlencoded BODY — Google's token endpoint rejects query-string
  // params here. Same fix as the initial exchange.
  const refreshBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await axios.post(
    TOKEN_URL,
    refreshBody.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, expires_in } = response.data;
  if (!access_token) throw new Error('Google did not return an access token on refresh');

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  // Update the same account row (preserving refreshToken — Google doesn't
  // re-issue it on refresh).
  await oauthService.saveSocialCredentials(userId, 'google', {
    accessToken: access_token,
    refreshToken: creds.refreshToken,
    platformUserId: creds.platformUserId || creds.accountId,
    extra: {
      platformUserId: creds.platformUserId || creds.accountId,
      platformUsername: creds.platformUsername || null,
      avatar: creds.avatar || null,
      expiresAt,
    },
  });

  logger.info('Google token refreshed', { ...LOG_CONTEXT, userId, accountId: creds.accountId || accountId });
  return access_token;
}

/**
 * Disconnect Google. Pass `accountId` to drop one of multiple linked
 * Google accounts. Routes through the unified OAuthStorage helpers so
 * the accounts[] shape stays consistent with every other platform.
 */
async function disconnectGoogle(userId, accountId = null) {
  if (!userId) throw new Error('userId is required');
  const oauthService = require('./oauthService');
  const remaining = await oauthService.removeSocialAccount(userId, 'google', accountId);
  logger.info('Google account disconnected', { ...LOG_CONTEXT, userId, accountId, remaining });
  return { success: true, remaining };
}

/** Return every connected Google account. */
async function getConnectedAccounts(userId) {
  const oauthService = require('./oauthService');
  const accounts = await oauthService.listSocialAccounts(userId, 'google');
  return accounts.map((a) => ({
    platform: 'google',
    accountId: a.accountId,
    platform_user_id: a.platformUserId,
    username: a.platformUsername,
    display_name: a.platformUsername,
    avatar: a.avatar,
    isPrimary: a.isPrimary,
    isActive: a.isActive,
    connectedAt: a.addedAt,
  }));
}

module.exports = {
  isConfigured,
  getScope,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getGoogleClient,
  refreshAccessToken,
  disconnectGoogle,
  defaultRedirectUri,
  getConnectedAccounts,
  // Exposed so YouTube Analytics + Search Console clients share the same
  // credential-resolution path (GOOGLE_* → YOUTUBE_* fallback).
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleCallbackUrl,
};
