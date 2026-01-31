// Facebook OAuth Service
// Features: long-lived tokens, pages support, photo posts, rate limit handling.

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

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

async function getAuthorizationUrl(userId, callbackUrl) {
  if (!isConfigured()) throw new Error('Facebook OAuth not configured');
  if (!userId || !callbackUrl) throw new Error('userId and callbackUrl are required');

  const state = crypto.randomBytes(32).toString('hex');
  const scope = getScope();
  const clientId = process.env.FACEBOOK_APP_ID;
  const authUrl = `${GRAPH_API_BASE.replace('/v18.0', '')}/v18.0/dialog/oauth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(callbackUrl.trim())}&` +
    `state=${encodeURIComponent(state)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `response_type=code`;

  await User.findByIdAndUpdate(userId, {
    $set: { 'oauth.facebook.state': state },
  });

  logger.info('Facebook OAuth authorization URL generated', { ...LOG_CONTEXT, userId });
  return { url: authUrl, state };
}

async function exchangeCodeForToken(userId, code, state) {
  if (!isConfigured()) throw new Error('Facebook OAuth not configured');
  if (!userId || !code || !state) throw new Error('userId, code, and state are required');

  const user = await User.findById(userId);
  if (!user || !user.oauth?.facebook?.state || user.oauth.facebook.state !== state) {
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

  await User.findByIdAndUpdate(userId, {
    $set: {
      'oauth.facebook.accessToken': access_token,
      'oauth.facebook.connected': true,
      'oauth.facebook.connectedAt': new Date(),
      'oauth.facebook.expiresAt': expires_in ? new Date(Date.now() + expires_in * 1000) : null,
      'oauth.facebook.platformUserId': userInfo.id,
      'oauth.facebook.platformUsername': userInfo.name,
      'oauth.facebook.pages': pages,
    },
    $unset: { 'oauth.facebook.state': '' },
  });

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

async function getFacebookClient(userId, pageId = null) {
  const user = await User.findById(userId).select('oauth.facebook');
  if (!user || !user.oauth?.facebook?.connected || !user.oauth.facebook.accessToken) {
    throw new Error('Facebook account not connected');
  }

  if (pageId && user.oauth.facebook.pages) {
    const page = user.oauth.facebook.pages.find(p => p.id === pageId);
    if (page?.accessToken) return page.accessToken;
  }

  if (user.oauth.facebook.expiresAt && new Date() > user.oauth.facebook.expiresAt) {
    throw new Error('Facebook token expired. Please reconnect your account.');
  }

  return user.oauth.facebook.accessToken;
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

async function disconnectFacebook(userId) {
  if (!userId) throw new Error('userId is required');
  await User.findByIdAndUpdate(userId, { $unset: { 'oauth.facebook': '' } });
  logger.info('Facebook account disconnected', { ...LOG_CONTEXT, userId });
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
  disconnectFacebook,
  defaultRedirectUri,
};
