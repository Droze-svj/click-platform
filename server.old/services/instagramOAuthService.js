// Instagram OAuth Service
// Features: Basic Display API, long-lived token exchange, Mongoose storage.

const User = require('../models/User');
const oauthService = require('./OAuthService');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.instagram.com';
const DEFAULT_SCOPE = 'user_profile,user_media';
const LOG_CONTEXT = { service: 'instagram-oauth' };

function defaultRedirectUri() {
  return process.env.INSTAGRAM_REDIRECT_URI ||
    process.env.INSTAGRAM_CALLBACK_URL ||
    `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/instagram/callback`;
}

class InstagramOAuthService {
  constructor() {
    this.clientId = process.env.INSTAGRAM_CLIENT_ID;
    this.clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('Instagram OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('Instagram OAuth not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET', LOG_CONTEXT);
    }
  }

  isConfigured() {
    return this.isConfiguredFlag;
  }

  getScope() {
    const s = process.env.INSTAGRAM_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(userId, state, callbackUrl) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');
    
    const redirectUri = callbackUrl || this.redirectUri;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: this.getScope(),
      response_type: 'code',
      state,
    });

    // Store state in User model for verification
    await User.findByIdAndUpdate(userId, {
      $set: { 'oauth.instagram.state': state },
    });

    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for tokens (includes long-lived token exchange)
   */
  async exchangeCodeForToken(userId, code, state) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');

    // Verify state
    const user = await User.findById(userId);
    if (!user || !user.oauth?.instagram?.state || user.oauth.instagram.state !== state) {
      logger.warn('Instagram OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
      throw new Error('Invalid OAuth state');
    }

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
    
    // Exchange for long-lived token (60 days)
    const longLivedUrl = `${GRAPH_API_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${this.clientSecret}&access_token=${data.access_token}`;
    const longLivedRes = await fetch(longLivedUrl);

    let tokens = data;
    if (longLivedRes.ok) {
      const longLivedData = await longLivedRes.json();
      tokens = { ...data, ...longLivedData };
    }

    const profile = await this.getUserProfile(tokens.access_token);
    
    await oauthService.saveSocialCredentials(userId, 'instagram', {
      accessToken: tokens.access_token,
      refreshToken: null, // Instagram Basic Display API doesn't provide refresh tokens for long-lived tokens
      extra: {
        platformUserId: profile.id,
        platformUsername: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        metadata: profile.metadata,
        state: null // Clear state
      }
    });

    return { success: true, platform: 'instagram', profile };
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

  async getConnectedAccounts(userId) {
    const creds = await oauthService.getSocialCredentials(userId, 'instagram');
    if (!creds || !creds.connected) return [];

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
    await User.findByIdAndUpdate(userId, {
      $set: { 'oauth.instagram': { connected: false } }
    });
    logger.info('Instagram account disconnected', { userId });
    return { success: true };
  }

  async getInstagramClient(userId) {
    const creds = await oauthService.getSocialCredentials(userId, 'instagram');
    if (!creds?.accessToken) {
      throw new Error('No Instagram account connected');
    }
    return { accessToken: creds.accessToken };
  }

  async postToInstagram(userId, imageUrl, caption, options = {}) {
    // Placeholder for actual Instagram Graph API posting (requires Business/Creator account)
    logger.info('Posting to Instagram', { userId, imageUrl, options });
    return { id: 'mock_instagram_post_id', status: 'published' };
  }

  async disconnectInstagram(userId) {
    return this.disconnectAccount(userId);
  }
}

module.exports = new InstagramOAuthService();
