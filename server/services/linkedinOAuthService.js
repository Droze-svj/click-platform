/**
 * LinkedIn OAuth Service (Refactored for Sovereign 2026 / Mongoose)
 */

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const User = require('../models/User');
const oauthService = require('./oauthService');
const OAuthStorage = require('../utils/oauthStorage');

// Supabase users have UUIDs; Mongoose User.findById throws CastError on them.
// Route UUID users through OAuthStorage (Supabase social_links.oauth.linkedin);
// keep the legacy User.oauth.linkedin path for ObjectId users.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
const ASSETS_REGISTER_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload';

const DEFAULT_REFRESH_BUFFER_SEC = 5 * 60;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SCOPE = 'openid profile email w_member_social';
const LOG_CONTEXT = { service: 'linkedin-oauth' };

function isConfigured() {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

function getScope() {
  const s = process.env.LINKEDIN_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

function defaultRedirectUri() {
  return process.env.LINKEDIN_CALLBACK_URL ||
    `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/linkedin/callback`;
}

/**
 * Handle LinkedIn API errors specifically
 */
function handleLinkedInError(err, userId, action) {
  const status = err.response?.status;
  const data = err.response?.data;
  logger.error('LinkedIn API Error', { userId, action, status, data, error: err.message });
  
  if (status === 401) {
    return new Error('LinkedIn authorization expired. Please reconnect your account.');
  }
  return new Error(data?.message || 'LinkedIn connectivity issue.');
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, state, callbackUrl) {
  if (!isConfigured()) throw new Error('LinkedIn OAuth not configured');

  const oauthState = state || crypto.randomBytes(32).toString('hex');

  if (isMongoUserId(userId)) {
    // Legacy Mongo user — persist state to the User document.
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.oauth) user.oauth = {};
    if (!user.oauth.linkedin) user.oauth.linkedin = {};
    user.oauth.linkedin.state = oauthState;
    user.oauth.linkedin.stateCreatedAt = new Date();
    user.markModified('oauth');
    await user.save();
  } else {
    // Supabase user (UUID) — persist state via OAuthStorage (Supabase social_links).
    await OAuthStorage.saveTokens(userId, 'linkedin', {
      state: oauthState,
      stateCreatedAt: new Date().toISOString(),
    });
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: callbackUrl || defaultRedirectUri(),
    state: oauthState,
    scope: getScope(),
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * Exchange code for token
 */
async function exchangeCodeForToken(userId, code, state) {
  // Resolve the OAuth state we saved during getAuthorizationUrl.
  let linkedinData;
  if (isMongoUserId(userId)) {
    const user = await User.findById(userId);
    if (!user || !user.oauth?.linkedin) throw new Error('OAuth session not found');
    linkedinData = user.oauth.linkedin;
  } else {
    linkedinData = await OAuthStorage.loadTokens(userId, 'linkedin');
    if (!linkedinData) throw new Error('OAuth session not found');
  }
  if (linkedinData.state !== state) throw new Error('Invalid state');

  try {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: defaultRedirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, expires_in, refresh_token } = response.data;
    const profile = await getLinkedInUserInfo(access_token);

    await oauthService.saveSocialCredentials(userId, 'linkedin', {
      accessToken: access_token,
      refreshToken: refresh_token,
      extra: {
        platformUserId: profile.id,
        platformUsername: profile.name,
        avatar: profile.picture,
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
      }
    });

    return profile;
  } catch (error) {
    throw handleLinkedInError(error, userId, 'exchangeCodeForToken');
  }
}

async function getLinkedInUserInfo(accessToken) {
  const response = await axios.get(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = response.data;
  return {
    id: data.sub,
    name: data.name,
    email: data.email,
    picture: data.picture
  };
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId) {
  const creds = await oauthService.getSocialCredentials(userId, 'linkedin');
  if (!creds?.refreshToken) throw new Error('No refresh token');

  try {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, expires_in, refresh_token: newRefresh } = response.data;

    await oauthService.saveSocialCredentials(userId, 'linkedin', {
      accessToken: access_token,
      refreshToken: newRefresh || creds.refreshToken,
      extra: {
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        lastRefreshAt: new Date()
      }
    });

    return access_token;
  } catch (error) {
    throw handleLinkedInError(error, userId, 'refreshAccessToken');
  }
}

async function getAccessTokenForAccount(userId) {
  const creds = await oauthService.getSocialCredentials(userId, 'linkedin');
  if (!creds || !creds.accessToken) throw new Error('LinkedIn not connected');

  const expiresAt = creds.expiresAt ? new Date(creds.expiresAt).getTime() : null;
  // Use a 5-minute buffer
  if (expiresAt && Date.now() >= expiresAt - 300000) {
    if (creds.refreshToken) return await refreshAccessToken(userId);
  }

  return creds.accessToken;
}

async function postToLinkedIn(userId, text, options = {}) {
  const accessToken = await getAccessTokenForAccount(userId);
  const userInfo = await getLinkedInUserInfo(accessToken);
  const authorUrn = `urn:li:person:${userInfo.id}`;

  const postData = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const response = await axios.post(UGC_POSTS_URL, postData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });

  return response.data;
}

/**
 * Disconnect LinkedIn. Pass `accountId` to drop one of multiple accounts.
 */
async function disconnectLinkedIn(userId, accountId = null) {
  const remaining = await oauthService.removeSocialAccount(userId, 'linkedin', accountId);
  logger.info('LinkedIn account disconnected', { userId, accountId, remaining });
  return { success: true, remaining };
}

/**
 * Return every connected LinkedIn account for this user.
 */
async function getConnectedAccounts(userId) {
  const accounts = await oauthService.listSocialAccounts(userId, 'linkedin');
  return accounts.map((a) => ({
    platform: 'linkedin',
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

/**
 * Status object used by the dashboard "connected?" indicator.
 */
async function getConnectionStatus(userId) {
  const accounts = await getConnectedAccounts(userId);
  return {
    connected: accounts.length > 0,
    accountCount: accounts.length,
    accounts,
  };
}

async function getLinkedInClient(userId) {
  const accessToken = await getAccessTokenForAccount(userId);
  return axios.create({
    baseURL: 'https://api.linkedin.com/v2/',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    }
  });
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getLinkedInUserInfo,
  refreshAccessToken,
  getAccessTokenForAccount,
  postToLinkedIn,
  disconnectLinkedIn,
  getLinkedInClient,
  getConnectedAccounts,
  getConnectionStatus,
};
