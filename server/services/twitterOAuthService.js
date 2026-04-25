/**
 * Twitter (X) OAuth Service (Refactored for Sovereign 2026 / Mongoose)
 */

const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const User = require('../models/User');
const oauthService = require('./oauthService');

const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const API_BASE = 'https://api.twitter.com/2';
const DEFAULT_SCOPE = 'tweet.read tweet.write users.read offline.access';

function isConfigured() {
  return !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET);
}

function getScope() {
  const s = process.env.TWITTER_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

function defaultRedirectUri() {
  return process.env.TWITTER_CALLBACK_URL ||
    process.env.TWITTER_REDIRECT_URI ||
    `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/twitter/callback`;
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, state, callbackUrl) {
  if (!isConfigured()) throw new Error('Twitter OAuth not configured');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Twitter uses PKCE, code_challenge is derived from code_verifier
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  if (!user.oauth) user.oauth = {};
  user.oauth.twitter = {
    ...user.oauth.twitter,
    codeVerifier: verifier,
    state,
    stateCreatedAt: new Date()
  };

  user.markModified('oauth');
  await user.save();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: callbackUrl || defaultRedirectUri(),
    scope: getScope(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

/**
 * Get connected account details
 */
async function getConnectedAccounts(userId) {
  const creds = await oauthService.getSocialCredentials(userId, 'twitter');
  if (!creds || !creds.connectedAt) return null;
  return {
    platform: 'twitter',
    username: creds.platformUsername,
    avatar: creds.avatar,
    connectedAt: creds.connectedAt
  };
}

/**
 * Exchange code for token
 */
async function exchangeCodeForToken(userId, code, state) {
  const user = await User.findById(userId);
  if (!user || !user.oauth?.twitter) throw new Error('OAuth session not found');

  const twitterData = user.oauth.twitter;
  if (twitterData.state !== state) throw new Error('Invalid state');

  const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(TOKEN_URL, new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: defaultRedirectUri(),
    code_verifier: twitterData.codeVerifier || 'challenge',
  }), {
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  });

  const { access_token, expires_in, refresh_token } = response.data;
  const profile = await getUserProfile(access_token);

  await oauthService.saveSocialCredentials(userId, 'twitter', {
    accessToken: access_token,
    refreshToken: refresh_token,
    extra: {
      platformUserId: profile.id,
      platformUsername: profile.username,
      avatar: profile.avatar,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
      codeVerifier: null, // Clear verifier
      code: null // Clear state
    }
  });

  return profile;
}

async function getUserProfile(accessToken) {
  const response = await axios.get(`${API_BASE}/users/me?user.fields=profile_image_url,description,public_metrics`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = response.data.data;
  return {
    id: data.id,
    username: data.username,
    display_name: data.name,
    avatar: data.profile_image_url,
    description: data.description,
    followers_count: data.public_metrics?.followers_count,
    following_count: data.public_metrics?.following_count,
  };
}

async function postTweet(userId, tweetText, options = {}) {
  const accessToken = await getAccessTokenForAccount(userId);
  const tweetData = { text: tweetText };
  if (options.mediaIds?.length > 0) {
    tweetData.media = { media_ids: options.mediaIds };
  }

  const response = await axios.post(`${API_BASE}/tweets`, tweetData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data.data;
}

async function refreshToken(userId) {
  const creds = await oauthService.getSocialCredentials(userId, 'twitter');
  if (!creds?.refreshToken) {
    logger.error('No refresh token available for Twitter', { userId });
    throw new Error('No refresh token available. Please reconnect your Twitter account.');
  }

  const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64');
  
  try {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
      client_id: process.env.TWITTER_CLIENT_ID,
    }), {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000 // 10s timeout
    });

    const { access_token, refresh_token: newRefresh, expires_in } = response.data;

    await oauthService.saveSocialCredentials(userId, 'twitter', {
      accessToken: access_token,
      refreshToken: newRefresh || creds.refreshToken,
      extra: {
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        lastRefreshAt: new Date()
      }
    });

    logger.info('Twitter token rotated successfully', { userId });
    return access_token;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    logger.error('Twitter token refresh failed', { userId, status, data, error: error.message });
    
    if (status === 400 || status === 401) {
      throw new Error('Twitter authorization expired. Please reconnect your account.');
    }
    throw new Error('Failed to refresh Twitter access token.');
  }
}

async function getAccessTokenForAccount(userId) {
  const creds = await oauthService.getSocialCredentials(userId, 'twitter');
  if (!creds || !creds.accessToken) {
    throw new Error('Twitter not connected');
  }

  const expiresAt = creds.expiresAt ? new Date(creds.expiresAt).getTime() : null;
  // Use a 10-minute buffer for rotation
  if (expiresAt && Date.now() >= expiresAt - 600000) { 
    logger.info('Twitter token expiring soon, rotating...', { userId, expiresAt: new Date(expiresAt) });
    if (creds.refreshToken) {
      return await refreshToken(userId);
    }
  }

  return creds.accessToken;
}

async function disconnectTwitter(userId) {
  const user = await User.findById(userId);
  if (user?.oauth) {
    user.oauth.twitter = { connected: false };
    user.markModified('oauth');
    await user.save();
  }
}

module.exports = {
  isConfigured,
  getScope,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserProfile,
  postTweet,
  refreshToken,
  getAccessTokenForAccount,
  getConnectedAccounts,
  disconnectTwitter,
  defaultRedirectUri,
};
