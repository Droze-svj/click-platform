/**
 * LinkedIn OAuth Service (Refactored for Sovereign 2026 / Mongoose)
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const oauthService = require('./oauthService');

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
  
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const oauthState = state || crypto.randomBytes(32).toString('hex');
  
  // Persist state to User model for validation during callback
  if (!user.oauth) user.oauth = {};
  if (!user.oauth.linkedin) user.oauth.linkedin = {};
  user.oauth.linkedin.state = oauthState;
  user.oauth.linkedin.stateCreatedAt = new Date();
  user.markModified('oauth');
  await user.save();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: callbackUrl || defaultRedirectUri(),
    state: oauthState,
    scope: getScope(),
  });

    stateCreatedAt: new Date()
  };

  user.markModified('oauth');
  await user.save();

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * Exchange code for token
 */
async function exchangeCodeForToken(userId, code, state) {
  const user = await User.findById(userId);
  if (!user || !user.oauth?.linkedin) throw new Error('OAuth session not found');

  const linkedinData = user.oauth.linkedin;
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

async function disconnectLinkedIn(userId) {
  const user = await User.findById(userId);
  if (user && user.oauth && user.oauth.linkedin) {
    user.oauth.linkedin = { connected: false };
    user.markModified('oauth');
    await user.save();
  }
  logger.info('LinkedIn account disconnected', { userId });
  return { success: true };
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
  getLinkedInClient
};
