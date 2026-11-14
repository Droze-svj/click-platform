// Facebook OAuth Service
// Features: long-lived tokens, pages support, photo posts, rate limit handling.

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { resolveOAuthCallbackUrl } = require('../utils/oauthCallbackUrl');
const User = require('../models/User');
const OAuthStorage = require('../utils/oauthStorage');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { GRAPH_BASE, DIALOG_BASE } = require('../utils/metaGraph');
const { publicMediaUrl } = require('../utils/publicMediaUrl');

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

const GRAPH_API_BASE = GRAPH_BASE;
// business_management: Pages owned through a Meta Business portfolio only show
// up in /me/accounts with it. read_insights: post analytics.
const DEFAULT_SCOPE = 'pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,business_management,public_profile';
const LOG_CONTEXT = { service: 'facebook-oauth' };

function isConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

function getScope() {
  const s = process.env.FACEBOOK_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

// Delegates to the shared resolver so the authorize step and the token exchange
// can never derive different values (they previously used different env names
// and different fallbacks — see utils/oauthCallbackUrl.js).
function defaultRedirectUri(req) {
  return resolveOAuthCallbackUrl('facebook', req);
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
  return `${DIALOG_BASE}?${params.toString()}`;
}

// callbackUrl MUST be the value the authorize step used; the callback route
// resolves it from the live request and passes it in. Falling back to the
// default here is what made every exchange fail with redirect_uri_mismatch.
async function exchangeCodeForToken(userId, code, state, callbackUrl) {
  if (!isConfigured()) throw new Error('Facebook OAuth not configured');
  if (!userId || !code || !state) throw new Error('userId, code, and state are required');

  const fbOauth = await readFacebookOauth(userId);
  if (!fbOauth?.state || fbOauth.state !== state) {
    logger.warn('Facebook OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
    throw new Error('Invalid OAuth state');
  }

  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = callbackUrl || defaultRedirectUri();

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
      params: { access_token: accessToken, fields: 'id,name,access_token,instagram_business_account' },
    });
    return (response.data.data || []).map(page => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagramBusinessId: page.instagram_business_account?.id || null,
    }));
  } catch (error) {
    logger.warn('Facebook pages fetch error', { ...LOG_CONTEXT, error: error.message });
    return [];
  }
}

async function getFacebookClient(userId, pageIdOrAccountId = null) {
  // Read through the unified credential store. The first positional arg is
  // either a Facebook Page id (for page-targeted posts) or a Facebook user
  // accountId (for multi-account selection).
  const oauthService = require('./oauthService');
  let creds = await oauthService.getSocialCredentials(userId, 'facebook', pageIdOrAccountId);
  if (!creds || !creds.accessToken) {
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

/**
 * The Page a post goes to, with its page access token. Meta only lets apps
 * publish to Pages (posting to a personal profile via /me/feed was removed), so
 * without an explicit pageId we use the creator's first connected Page.
 */
async function resolvePage(userId, pageId = null) {
  const oauthService = require('./oauthService');
  const creds = await oauthService.getSocialCredentials(userId, 'facebook', null);
  if (!creds || !creds.accessToken) throw new Error('Facebook account not connected');
  const pages = Array.isArray(creds.pages) ? creds.pages.filter((p) => p && p.id && p.accessToken) : [];
  const page = pageId
    ? pages.find((p) => p.id === String(pageId))
    : (pages.find((p) => creds.defaultPageId && p.id === String(creds.defaultPageId)) || pages[0]);
  if (!page) {
    throw new Error(pageId
      ? 'That Facebook Page is not connected. Reconnect Facebook and select the Page.'
      : 'No Facebook Page connected. Facebook only allows apps to post to Pages: reconnect Facebook and select a Page you manage.');
  }
  return { pageId: page.id, pageName: page.name || null, accessToken: page.accessToken };
}

/** The creator's Pages (no tokens) and which one posts go to by default. */
async function listPages(userId) {
  const oauthService = require('./oauthService');
  const creds = await oauthService.getSocialCredentials(userId, 'facebook', null);
  if (!creds || !creds.accessToken) return { connected: false, pages: [], defaultPageId: null };
  const pages = (Array.isArray(creds.pages) ? creds.pages : []).filter((p) => p && p.id);
  const defaultPageId = (creds.defaultPageId && pages.some((p) => p.id === String(creds.defaultPageId)))
    ? String(creds.defaultPageId)
    : (pages[0]?.id || null);
  return {
    connected: true,
    defaultPageId,
    pages: pages.map((p) => ({ id: p.id, name: p.name || null, hasInstagram: !!p.instagramBusinessId })),
  };
}

async function setDefaultPage(userId, pageId) {
  const { pages } = await listPages(userId);
  if (!pages.some((p) => p.id === String(pageId))) {
    const err = new Error('That Page is not connected. Reconnect Facebook and select it.');
    err.statusCode = 404;
    throw err;
  }
  await writeFacebookOauth(userId, { defaultPageId: String(pageId) });
  return { defaultPageId: String(pageId) };
}

async function postToFacebook(userId, text, options = {}, retries = 1) {
  if (!userId || (!text && !options.videoUrl)) throw new Error('userId and text (or a video) are required');

  const { pageId: targetId, accessToken } = await resolvePage(userId, options.pageId || null);

  if (options.videoUrl) {
    const videoRes = await axios.post(`${GRAPH_API_BASE}/${targetId}/videos`, null, {
      params: { access_token: accessToken, file_url: publicMediaUrl(options.videoUrl), description: text },
      timeout: 120000,
    });
    logger.info('Facebook video post successful', { ...LOG_CONTEXT, userId, postId: videoRes.data.id });
    return { id: videoRes.data.id, url: `https://www.facebook.com/${videoRes.data.id}`, text };
  }

  if (options.imageUrl) {
    const photoRes = await axios.post(`${GRAPH_API_BASE}/${targetId}/photos`, null, {
      params: { access_token: accessToken, url: publicMediaUrl(options.imageUrl), caption: text },
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
 * Reply to a Facebook comment / post as the connected page. `commentId` is the
 * object being replied to. Documented Graph API: POST /{object-id}/comments with
 * a message. (Wired for the AI responder; only called when SOCIAL_REPLY_SEND=true.)
 */
async function replyToComment(userId, commentId, message) {
  if (!commentId) throw new Error('commentId is required');
  const accessToken = await getFacebookClient(userId);
  const response = await axios.post(
    `${GRAPH_API_BASE}/${encodeURIComponent(commentId)}/comments`,
    null,
    { params: { access_token: accessToken, message: String(message || '') }, timeout: 15000 },
  );
  return response.data;
}

/**
 * Refresh a long-lived access token
 */
async function refreshAccessToken(userId) {
  // Read the DECRYPTED token through the credential store. This used to send
  // the encrypted value from the raw row to Meta, so every refresh failed and
  // creators got "reconnect" notices.
  const oauthService = require('./oauthService');
  const creds = await oauthService.getSocialCredentials(userId, 'facebook', null);
  if (!creds?.accessToken) throw new Error('Facebook not connected');

  try {
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: creds.accessToken,
      },
    });

    const { access_token, expires_in } = response.data;
    const pages = await getFacebookPages(access_token);
    await oauthService.saveSocialCredentials(userId, 'facebook', {
      accessToken: access_token,
      refreshToken: null,
      platformUserId: creds.platformUserId,
      extra: {
        platformUserId: creds.platformUserId,
        platformUsername: creds.platformUsername || null,
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
        // Keep the stored Pages if the lookup came back empty (transient error).
        ...(pages.length ? { pages } : {}),
      },
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
  resolvePage,
  listPages,
  setDefaultPage,
  postToFacebook,
  replyToComment,
  refreshAccessToken,
  disconnectFacebook,
  defaultRedirectUri,
  getConnectedAccounts,
};
