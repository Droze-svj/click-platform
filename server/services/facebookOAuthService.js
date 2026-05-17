// Facebook OAuth Service
// Features: long-lived tokens, pages support, photo posts, rate limit handling.

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const User = require('../models/User');
const OAuthStorage = require('../utils/oauthStorage');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

// Supabase users have UUIDs; Mongoose User.findById throws CastError on them.
// These helpers route reads/writes to either User.oauth.facebook (legacy
// Mongo users) or Supabase social_links.oauth.facebook (Supabase users).
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

async function readFacebookOauth(userId) {
  if (isMongoUserId(userId)) {
    const user = await User.findById(userId).select('oauth.facebook');
    return user?.oauth?.facebook || null;
  }
  return await OAuthStorage.loadTokens(userId, 'facebook');
}

async function writeFacebookOauth(userId, patch) {
  if (isMongoUserId(userId)) {
    const setPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      setPatch[`oauth.facebook.${k}`] = v;
    }
    await User.findByIdAndUpdate(userId, { $set: setPatch });
  } else {
    await OAuthStorage.saveTokens(userId, 'facebook', patch);
  }
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';
const DEFAULT_SCOPE = 'pages_manage_posts,pages_read_engagement,pages_show_list,public_profile';
const LOG_CONTEXT = { service: 'facebook-oauth' };

function isConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

function getScope() {
  const s = process.env.FACEBOOK_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

function defaultRedirectUri() {
  return process.env.FACEBOOK_CALLBACK_URL ||
    `${process.env.FRONTEND_URL || process.env.API_URL || 'http://localhost:5001'}/api/oauth/facebook/callback`;
}


async function getAuthorizationUrl(userId, state, callbackUrl) {
  if (!isConfigured()) throw new Error('Facebook OAuth not configured');

  const oauthState = state || crypto.randomBytes(32).toString('hex');

  // Persist state — works for both Mongo ObjectIds and Supabase UUIDs.
  await writeFacebookOauth(userId, {
    state: oauthState,
    stateCreatedAt: new Date().toISOString(),
  });

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: callbackUrl || defaultRedirectUri(),
    state: oauthState,
    scope: getScope(),
    response_type: 'code'
  });

  logger.info('Facebook OAuth authorization URL generated', { ...LOG_CONTEXT, userId });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForToken(userId, code, state) {
  if (!isConfigured()) throw new Error('Facebook OAuth not configured');
  if (!userId || !code || !state) throw new Error('userId, code, and state are required');

  const fbOauth = await readFacebookOauth(userId);
  if (!fbOauth?.state || fbOauth.state !== state) {
    logger.warn('Facebook OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
    throw new Error('Invalid OAuth state');
  }

  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = defaultRedirectUri();

  const shortLivedRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
    params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code },
  });

  const longLivedRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLivedRes.data.access_token,
    },
  });

  const { access_token, expires_in } = longLivedRes.data;
  if (!access_token) throw new Error('Facebook did not return an access token');

  const userInfo = await getFacebookUserInfo(access_token);
  const pages = await getFacebookPages(access_token);

  // Route through the unified credential store so Facebook lives in the
  // same accounts[] shape as every other platform. Pages are kept on the
  // root row (not per-account) because they're a Facebook-only concept.
  const oauthService = require('./oauthService');
  await oauthService.saveSocialCredentials(userId, 'facebook', {
    accessToken: access_token,
    refreshToken: null,
    platformUserId: userInfo.id,
    extra: {
      platformUserId: userInfo.id,
      platformUsername: userInfo.name,
      avatar: userInfo.picture || null,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
      pages,
    },
  });

  // Clear the consumed OAuth state — root-level field, not per-account.
  await writeFacebookOauth(userId, { state: null });

  logger.info('Facebook OAuth token exchange successful', { ...LOG_CONTEXT, userId });
  return { accessToken: access_token, expiresIn: expires_in };
}

async function getFacebookUserInfo(accessToken) {
  const response = await axios.get(`${GRAPH_API_BASE}/me`, {
    params: { access_token: accessToken, fields: 'id,name,email,picture' },
  });
  return {
    id: response.data.id,
    name: response.data.name,
    email: response.data.email,
    picture: response.data.picture?.data?.url,
  };
}

async function getFacebookPages(accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: { access_token: accessToken, fields: 'id,name,access_token' },
    });
    return response.data.data.map(page => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));
  } catch (error) {
    logger.warn('Facebook pages fetch error', { ...LOG_CONTEXT, error: error.message });
    return [];
  }
}

async function getFacebookClient(userId, pageIdOrAccountId = null) {
  // Read through the unified credential store. The first positional arg is
  // either a Facebook Page id (for page-targeted posts) or a Facebook user
  // accountId (for multi-account selection). We try as accountId first;
  // if that miss yields no creds, treat it as a pageId and fall back.
  const oauthService = require('./oauthService');
  let creds = await oauthService.getSocialCredentials(userId, 'facebook', pageIdOrAccountId);
  if (!creds || !creds.accessToken) {
    // Maybe pageIdOrAccountId is a Page id rather than account id — load
    // active credentials and look up the page below.
    creds = await oauthService.getSocialCredentials(userId, 'facebook', null);
  }
  if (!creds || !creds.accessToken) {
    throw new Error('Facebook account not connected');
  }

  if (pageIdOrAccountId && Array.isArray(creds.pages)) {
    const page = creds.pages.find((p) => p.id === pageIdOrAccountId);
    if (page?.accessToken) return page.accessToken;
  }

  if (creds.expiresAt && new Date() > new Date(creds.expiresAt)) {
    throw new Error('Facebook token expired. Please reconnect your account.');
  }

  return creds.accessToken;
}

async function postToFacebook(userId, text, options = {}, retries = 1) {
  if (!userId || !text) throw new Error('userId and text are required');

  const accessToken = await getFacebookClient(userId, options.pageId);
  const targetId = options.pageId || 'me';

  if (options.imageUrl) {
    const photoRes = await axios.post(`${GRAPH_API_BASE}/${targetId}/photos`, null, {
      params: { access_token: accessToken, url: options.imageUrl, caption: text },
    });
    logger.info('Facebook post successful', { ...LOG_CONTEXT, userId, postId: photoRes.data.id });
    return {
      id: photoRes.data.id,
      url: photoRes.data.post_id ? `https://www.facebook.com/${photoRes.data.post_id}` : null,
      text,
    };
  }

  const postData = { message: text, ...(options.link && { link: options.link }) };

  try {
    const response = await retryWithBackoff(
      () => axios.post(`${GRAPH_API_BASE}/${targetId}/feed`, null, {
        params: { access_token: accessToken, ...postData },
      }),
      {
        maxRetries: retries,
        initialDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn('Facebook post retry', { ...LOG_CONTEXT, attempt, error: error.message, userId });
        },
      }
    );

    logger.info('Facebook post successful', { ...LOG_CONTEXT, userId, postId: response.data.id });
    return {
      id: response.data.id,
      url: `https://www.facebook.com/${response.data.id}`,
      text,
    };
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }
    logger.error('Facebook post error', { ...LOG_CONTEXT, error: error.message, userId });
    throw error;
  }
}

/**
 * Refresh a long-lived access token
 */
async function refreshAccessToken(userId) {
  const fbOauth = await readFacebookOauth(userId);
  if (!fbOauth?.accessToken) throw new Error('Facebook not connected');

  try {
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: fbOauth.accessToken
      }
    });

    const { access_token, expires_in } = response.data;

    await writeFacebookOauth(userId, {
      accessToken: access_token,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
      lastRefreshAt: new Date().toISOString(),
    });

    logger.info('Facebook token refreshed successfully', { ...LOG_CONTEXT, userId });
    return access_token;
  } catch (error) {
    logger.error('Facebook token refresh failed', { ...LOG_CONTEXT, userId, error: error.message });
    throw error;
  }
}

/**
 * Disconnect Facebook. Pass `accountId` to drop one of multiple accounts.
 */
async function disconnectFacebook(userId, accountId = null) {
  if (!userId) throw new Error('userId is required');
  const oauthService = require('./oauthService');
  const remaining = await oauthService.removeSocialAccount(userId, 'facebook', accountId);
  logger.info('Facebook account disconnected', { ...LOG_CONTEXT, userId, accountId, remaining });
  return { success: true, remaining };
}

/** Return every connected Facebook account. */
async function getConnectedAccounts(userId) {
  const oauthService = require('./oauthService');
  const accounts = await oauthService.listSocialAccounts(userId, 'facebook');
  return accounts.map((a) => ({
    platform: 'facebook',
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
  getFacebookUserInfo,
  getFacebookPages,
  getFacebookClient,
  postToFacebook,
  refreshAccessToken,
  disconnectFacebook,
  defaultRedirectUri,
  getConnectedAccounts,
};
