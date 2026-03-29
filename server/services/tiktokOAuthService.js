// TikTok OAuth Service
// Features: OAuth 2.0, video upload/publish permissions, User model storage.

const OAuthService = require('./OAuthService');
const logger = require('../utils/logger');
const fs = require('fs');
const axios = require('axios');

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE = 'https://open.tiktokapis.com/v2';
const DEFAULT_SCOPE = 'user.info.basic,video.upload,video.publish';
const LOG_CONTEXT = { service: 'tiktok-oauth' };

function defaultRedirectUri() {
  return process.env.TIKTOK_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social/connect/tiktok/callback`;
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

  getAuthorizationUrl(state) {
    if (!this.isConfigured()) throw new Error('TikTok OAuth not configured');
    const params = new URLSearchParams({
      client_key: this.clientKey,
      scope: this.getScope(),
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
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
    const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
    if (!creds) return [];

    return [{
      platform: 'tiktok',
      platform_user_id: creds.platformUserId,
      username: creds.platformUsername,
      display_name: creds.platformUsername,
      avatar: creds.avatar,
      is_connected: true,
      created_at: creds.connectedAt
    }];
  }

  async disconnectAccount(userId) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user && user.oauth && user.oauth.tiktok) {
      user.oauth.tiktok = { connected: false };
      user.markModified('oauth');
      await user.save();
    }
    logger.info('TikTok account disconnected', { userId });
    return { success: true };
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

  async uploadVideoToTikTok(userId, videoPath) {
    try {
      logger.info('TikTok: Starting video upload initialization...', { userId, videoPath });
      
      const creds = await OAuthService.getSocialCredentials(userId, 'tiktok');
      if (!creds?.accessToken) {
        throw new Error('No TikTok account connected or token missing');
      }

      const videoStats = fs.statSync(videoPath);
      
      // Phase 1: Initialize the upload
      const initResponse = await axios.post(`${API_BASE}/post/publish/video/init/`, {
        post_info: {
          title: "Uploaded from Sovereign",
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_ad_tag: false
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoStats.size,
          chunk_size: videoStats.size,
          total_chunk_count: 1
        }
      }, {
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const { publish_id, upload_url } = initResponse.data.data;
      logger.info('TikTok: Upload initialized', { userId, publish_id });

      // Phase 2: Upload the video file
      const videoData = fs.readFileSync(videoPath);
      await axios.put(upload_url, videoData, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoStats.size
        }
      });

      logger.info('TikTok: Video file uploaded successfully', { userId, publish_id });
      return { 
        id: publish_id, 
        status: 'published',
        url: 'https://www.tiktok.com/@user/video/' + publish_id // Placeholder URL pattern
      };
    } catch (error) {
      logger.error('TikTok: Upload failed', { userId, error: error.response?.data || error.message });
      throw error;
    }
  }

  async postToTikTok(userId, postData) {
    const { videoPath, mediaUrl } = postData;
    const path = videoPath || mediaUrl;
    
    if (path && fs.existsSync(path)) {
      return this.uploadVideoToTikTok(userId, path);
    }
    
    throw new Error('TikTok requires a valid video file path for publishing');
  }

  async disconnectTikTok(userId) {
    return this.disconnectAccount(userId);
  }
}

module.exports = new TikTokOAuthService();

