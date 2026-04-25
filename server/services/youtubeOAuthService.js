// YouTube OAuth Service
// Features: Google OAuth 2.0, channel info, video upload permissions, User model storage.

const OAuthService = require('./oauthService');
const logger = require('../utils/logger');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const LOG_CONTEXT = { service: 'youtube-oauth' };

function defaultRedirectUri() {
  return process.env.YOUTUBE_REDIRECT_URI ||
    `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/youtube/callback`;
}

class YouTubeOAuthService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('YouTube OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET', LOG_CONTEXT);
    }
    
    // Bind methods to ensure they work when destructured in routes
    this.isConfigured = this.isConfigured.bind(this);
  }

  isConfigured() {
    return this.isConfiguredFlag;
  }

  getScope() {
    const s = process.env.YOUTUBE_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  async getAuthorizationUrl(userId, state, callbackUrl) {
    if (!this.isConfigured()) throw new Error('YouTube OAuth not configured');
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Persist state to User model
    if (!user.oauth) user.oauth = {};
    if (!user.oauth.youtube) user.oauth.youtube = {};
    user.oauth.youtube.state = state;
    user.oauth.youtube.stateCreatedAt = new Date();
    user.markModified('oauth');
    await user.save();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: callbackUrl || this.redirectUri,
      response_type: 'code',
      scope: this.getScope(),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) throw new Error('YouTube OAuth not configured');
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
      throw new Error(`YouTube OAuth token exchange failed: ${response.status} - ${errorData}`);
    }
    return await response.json();
  }

  async getUserProfile(accessToken) {
    const response = await fetch(`${API_BASE}/channels?part=snippet,statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`YouTube API channel fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.items?.length) {
      throw new Error('No YouTube channel found for this account');
    }

    const channel = data.items[0];
    return {
      id: channel.id,
      username: channel.snippet.title,
      display_name: channel.snippet.title,
      avatar: channel.snippet.thumbnails?.default?.url,
      metadata: {
        subscriber_count: channel.statistics?.subscriberCount,
        video_count: channel.statistics?.videoCount,
        view_count: channel.statistics?.viewCount,
      },
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

    await OAuthService.saveSocialCredentials(userId, 'youtube', credentials);
    logger.info('YouTube account connected', { userId, profileId: profile.id });
    
    return { success: true, platform: 'youtube', username: profile.username };
  }

  async getConnectedAccounts(userId) {
    const creds = await OAuthService.getSocialCredentials(userId, 'youtube');
    if (!creds) return [];

    return [{
      platform: 'youtube',
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
    if (user && user.oauth && user.oauth.youtube) {
      user.oauth.youtube = { connected: false };
      user.markModified('oauth');
      await user.save();
    }
    logger.info('YouTube account disconnected', { userId });
    return { success: true };
  }

  async getYouTubeUserInfo(accessToken) {
    return this.getUserProfile(accessToken);
  }

  async getYouTubeClient(userId) {
    const creds = await OAuthService.getSocialCredentials(userId, 'youtube');
    if (!creds?.accessToken) {
      throw new Error('No YouTube account connected or token missing');
    }

    const auth = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    auth.setCredentials({
      access_token: creds.accessToken,
      refresh_token: creds.refreshToken,
    });

    return google.youtube({ version: 'v3', auth });
  }

  async refreshAccessToken(userId) {
    logger.info('Refreshing YouTube access token', { userId });
    const creds = await OAuthService.getSocialCredentials(userId, 'youtube');
    if (!creds?.refreshToken) {
      throw new Error('No YouTube refresh token available');
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('YouTube token refresh failed', { userId, error: errorData });
      throw new Error(`YouTube token refresh failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    await OAuthService.saveSocialCredentials(userId, 'youtube', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || creds.refreshToken, // Rotation handling
      extra: {
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null
      }
    });

    return data.access_token;
  }

  async uploadVideoToYouTube(userId, videoPath, metadata = {}) {
    try {
      logger.info('YouTube: Starting video upload...', { userId, videoPath });
      const youtube = await this.getYouTubeClient(userId);

      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found at: ${videoPath}`);
      }

      const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: metadata.title || 'Untitled Sovereign Video',
            description: metadata.description || 'Generated by CLICK Sovereign platform',
            tags: metadata.tags || ['click', 'ai', 'sovereign'],
            categoryId: metadata.categoryId || '22', // People & Blogs
          },
          status: {
            privacyStatus: metadata.privacyStatus || 'unlisted',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      logger.info('YouTube: Video uploaded successfully', { userId, videoId: res.data.id });
      return { 
        id: res.data.id, 
        status: 'uploaded', 
        url: `https://www.youtube.com/watch?v=${res.data.id}` 
      };
    } catch (error) {
      logger.error('YouTube: Upload failed', { userId, error: error.message });
      throw error;
    }
  }

  async postToYouTube(userId, postData) {
    const { title, description, videoPath, mediaUrl } = postData;
    
    // If we have a local video path, use the upload function
    if (videoPath || (mediaUrl && fs.existsSync(mediaUrl))) {
      return this.uploadVideoToYouTube(userId, videoPath || mediaUrl, { title, description });
    }

    // Otherwise, it might be a Community Post (requires different API)
    // For now, we focus on video uploads as the primary feature
    throw new Error('YouTube text-only posts are not yet supported in Sovereign core');
  }

  async disconnectYouTube(userId) {
    return this.disconnectAccount(userId);
  }
}

module.exports = new YouTubeOAuthService();

