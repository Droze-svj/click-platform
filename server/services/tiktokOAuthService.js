// TikTok OAuth Service
// Features: OAuth 2.0, video upload/publish permissions, User model storage.

const OAuthService = require('./oauthService');
const OAuthStorage = require('../utils/oauthStorage');
const logger = require('../utils/logger');
const crypto = require('crypto');

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE = 'https://open.tiktokapis.com/v2';
const DEFAULT_SCOPE = 'user.info.basic,video.upload,video.publish';
const LOG_CONTEXT = { service: 'tiktok-oauth' };

function defaultRedirectUri() {
  return process.env.TIKTOK_REDIRECT_URI ||
    `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/tiktok/callback`;
}

class TikTokOAuthService {
  constructor() {
    this.clientKey = process.env.TIKTOK_CLIENT_KEY;
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.isConfiguredFlag = !!(this.clientKey && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('TikTok OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET', LOG_CONTEXT);
    }
    
    // Bind methods to ensure they work when destructured in routes
    this.isConfigured = this.isConfigured.bind(this);
  }

  isConfigured() {
    return this.isConfiguredFlag;
  }

  getScope() {
    const s = process.env.TIKTOK_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  async getAuthorizationUrl(userId, state, callbackUrl) {
    if (!this.isConfigured()) throw new Error('TikTok OAuth not configured');

    // Argument disambiguation:
    // If state is not provided or looks like a URL (since legacy callers pass callbackUrl as 2nd arg),
    // we generate a random state.
    let oauthState = state;
    let finalCallbackUrl = callbackUrl;

    if (!callbackUrl && typeof state === 'string' && state.includes('://')) {
      // 2-argument call: getAuthorizationUrl(userId, callbackUrl)
      oauthState = crypto.randomBytes(32).toString('hex');
      finalCallbackUrl = state;
    } else if (!state) {
      oauthState = crypto.randomBytes(32).toString('hex');
    }

    // Persist state. Supabase users (UUID) can't hit User.findById without a
    // CastError, so route them through OAuthStorage like the other 5
    // platforms. Mongo (ObjectId) users still use the legacy User.oauth
    // path so existing data keeps working.
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(String(userId))) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
      if (!user.oauth) user.oauth = {};
      if (!user.oauth.tiktok) user.oauth.tiktok = {};
      user.oauth.tiktok.state = oauthState;
      user.oauth.tiktok.stateCreatedAt = new Date();
      user.markModified('oauth');
      await user.save();
    } else {
      // Supabase user — namespaced state map so concurrent flows don't
      // overwrite each other (multi-account opens this risk).
      await OAuthStorage.putState(userId, 'tiktok', oauthState, { startedAt: new Date().toISOString() });
    }

    const params = new URLSearchParams({
      client_key: this.clientKey,
      scope: this.getScope(),
      response_type: 'code',
      redirect_uri: finalCallbackUrl || this.redirectUri,
      state: oauthState,
    });
    const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    return { url, state: oauthState };
  }

  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) throw new Error('TikTok OAuth not configured');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`TikTok OAuth token exchange failed: ${response.status} - ${errorData}`);
    }
    return await response.json();
  }

  async getUserProfile(accessToken) {
    const response = await fetch(`${API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`TikTok API user profile fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    const user = data.data.user;
    return {
      id: user.open_id,
      username: user.display_name,
      display_name: user.display_name,
      avatar: user.avatar_url,
      metadata: { union_id: user.union_id },
    };
  }

  async connectAccount(userId, tokens, profile) {
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      extra: {
        platformUserId: profile.id,
        platformUsername: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        metadata: profile.metadata
      }
    };

    await OAuthService.saveSocialCredentials(userId, 'tiktok', credentials);
    logger.info('TikTok account connected via Mongoose', { userId, profileId: profile.id });
    
    return { success: true, platform: 'tiktok', username: profile.username };
  }

  async getConnectedAccounts(userId) {
    const accounts = await OAuthService.listSocialAccounts(userId, 'tiktok');
    return accounts.map((a) => ({
      platform: 'tiktok',
      accountId: a.accountId,
      platform_user_id: a.platformUserId,
      username: a.platformUsername,
      display_name: a.platformUsername,
      avatar: a.avatar,
      isPrimary: a.isPrimary,
      isActive: a.isActive,
      is_connected: true,
      created_at: a.addedAt,
    }));
  }

  /**
   * Disconnect TikTok. Pass `accountId` to drop one of multiple accounts.
   */
  async disconnectAccount(userId, accountId = null) {
    const remaining = await OAuthService.removeSocialAccount(userId, 'tiktok', accountId);
    logger.info('TikTok account disconnected', { userId, accountId, remaining });
    return { success: true, remaining };
  }

  async getTikTokUserInfo(accessToken) {
    return this.getUserProfile(accessToken);
  }

  async getTikTokClient(userId) {
    const accounts = await this.getConnectedAccounts(userId);
    if (!accounts || accounts.length === 0) {
      throw new Error('No TikTok account connected');
    }
    const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
    return { accessToken: creds.accessToken };
  }

  async refreshAccessToken(userId) {
    logger.info('Refreshing TikTok access token', { userId });
    const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
    if (!creds?.refreshToken) {
      throw new Error('No TikTok refresh token available');
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('TikTok token refresh failed', { userId, error: errorData });
      throw new Error(`TikTok token refresh failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    await OAuthService.saveSocialCredentials(userId, 'tiktok', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || creds.refreshToken, // Handle rotation
      extra: {
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        platformUserId: data.open_id || creds.platformUserId
      }
    });

    return data.access_token;
  }

  // The actual TikTok Content Posting upload (init → chunked PUT with
  // Content-Range → honest 'processing' result) lives in the single canonical
  // implementation `TikTokSocialService`, which the LIVE publish path
  // (socialMediaService → TikTokSocialService.postToTikTok) also uses. These two
  // methods just resolve the user's stored token and delegate, so there is ONE
  // source of truth (no drift, one place to fix bugs).
  async uploadVideoToTikTok(userId, videoPath, caption) {
    const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
    if (!creds?.accessToken) {
      throw new Error('No TikTok account connected or token missing');
    }
    return require('./TikTokSocialService').uploadVideoToTikTok(creds.accessToken, videoPath, { caption });
  }

  async postToTikTok(userId, postData) {
    const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
    if (!creds?.accessToken) {
      throw new Error('No TikTok account connected or token missing');
    }
    const data = postData || {};
    return require('./TikTokSocialService').postToTikTok(
      { accessToken: creds.accessToken },
      { videoPath: data.videoPath, mediaUrl: data.mediaUrl, title: data.caption || data.title },
    );
  }

  async disconnectTikTok(userId) {
    return this.disconnectAccount(userId);
  }
}

module.exports = new TikTokOAuthService();

