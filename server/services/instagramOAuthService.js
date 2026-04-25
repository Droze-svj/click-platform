// Instagram OAuth Service
// Features: Basic Display API, long-lived token exchange, platform_accounts storage.

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const OAuthService = require('./oauthService');

const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.instagram.com';
const DEFAULT_SCOPE = 'user_profile,user_media';
const LOG_CONTEXT = { service: 'instagram-oauth' };

function defaultRedirectUri() {
  return process.env.INSTAGRAM_REDIRECT_URI ||
    `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/instagram/callback`;
}

class InstagramOAuthService {
  constructor() {
    this.clientId = process.env.INSTAGRAM_CLIENT_ID;
    this.clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.supabase = null;
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('Instagram OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('Instagram OAuth not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET', LOG_CONTEXT);
    }
  }

  getSupabaseClient() {
    if (!this.supabase) {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
    return this.supabase;
  }

  isConfigured() {
    return this.isConfiguredFlag;
  }

  getScope() {
    const s = process.env.INSTAGRAM_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  async getAuthorizationUrl(userId, state, callbackUrl) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Persist state to User model
    if (!user.oauth) user.oauth = {};
    if (!user.oauth.instagram) user.oauth.instagram = {};
    user.oauth.instagram.state = state;
    user.oauth.instagram.stateCreatedAt = new Date();
    user.markModified('oauth');
    await user.save();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: callbackUrl || this.redirectUri,
      scope: this.getScope(),
      response_type: 'code',
      state,
    });
    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Instagram OAuth token exchange failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const longLivedUrl = `${GRAPH_API_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${this.clientSecret}&access_token=${data.access_token}`;
    const longLivedRes = await fetch(longLivedUrl);

    if (!longLivedRes.ok) {
      return data;
    }

    const longLivedData = await longLivedRes.json();
    return { ...data, ...longLivedData };
  }

  async getUserProfile(accessToken) {
    const response = await fetch(`${GRAPH_API_BASE}/me?fields=id,username,account_type&access_token=${accessToken}`);

    if (!response.ok) {
      throw new Error(`Instagram API user profile fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      username: data.username,
      display_name: data.username,
      avatar: null,
      metadata: { account_type: data.account_type },
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
        metadata: profile.metadata,
        connectedAt: new Date()
      }
    };

    await OAuthService.saveSocialCredentials(userId, 'instagram', credentials);
    logger.info('Instagram account connected via Mongoose', { userId, profileId: profile.id });
    
    return { success: true, platform: 'instagram', username: profile.username };
  }

  async getConnectedAccounts(userId) {
    const creds = await OAuthService.getSocialCredentials(userId, 'instagram');
    if (!creds) return [];

    return [{
      platform: 'instagram',
      platform_user_id: creds.platformUserId,
      username: creds.platformUsername,
      display_name: creds.platformUsername,
      avatar: creds.avatar,
      is_connected: true,
      connected_at: creds.connectedAt
    }];
  }

  async disconnectAccount(userId) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user && user.oauth && user.oauth.instagram) {
      user.oauth.instagram = { connected: false };
      user.markModified('oauth');
      await user.save();
    }
    logger.info('Instagram account disconnected', { userId });
    return { success: true };
  }

  async getInstagramAccounts(userId) {
    return this.getConnectedAccounts(userId);
  }

  async getInstagramClient(userId) {
    const creds = await OAuthService.getSocialCredentials(userId, 'instagram');
    if (!creds?.accessToken) {
      throw new Error('No Instagram account connected or token missing');
    }
    return { accessToken: creds.accessToken };
  }

  async refreshAccessToken(userId) {
    logger.info('Refreshing Instagram access token', { userId });
    const creds = await OAuthService.getSocialCredentials(userId, 'instagram');
    if (!creds?.accessToken) throw new Error('Instagram not connected');

    try {
      // Instagram 'Basic Display API' uses a GET request to refresh long-lived tokens
      const refreshUrl = `${GRAPH_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${creds.accessToken}`;
      const response = await fetch(refreshUrl);

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('Instagram token refresh failed', { userId, status: response.status, errorData });
        throw new Error(`Instagram token refresh failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();

      await OAuthService.saveSocialCredentials(userId, 'instagram', {
        accessToken: data.access_token,
        refreshToken: null, // Basic Display API doesn't use refresh tokens for rotation
        extra: {
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
          lastRefreshAt: new Date()
        }
      });

      logger.info('Instagram token refreshed successfully', { userId });
      return data.access_token;
    } catch (error) {
      logger.error('Instagram token refresh failed', { userId, error: error.message });
      throw error;
    }
  }

  async postToInstagram(userId, imageUrl, caption, options = {}) {
    // Placeholder for actual Instagram posting logic
    logger.info('Posting to Instagram', { userId, imageUrl, options });
    return { id: 'mock_instagram_post_id', status: 'published' };
  }

  async disconnectInstagram(userId) {
    const accounts = await this.getConnectedAccounts(userId);
    if (accounts && accounts.length > 0) {
      return this.disconnectAccount(userId, accounts[0].platform_user_id);
    }
    return { success: true };
  }
}

module.exports = new InstagramOAuthService();
