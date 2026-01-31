// YouTube OAuth Service
// Features: Google OAuth 2.0, channel info, video upload permissions, platform_accounts storage.

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly userinfo.profile';
const LOG_CONTEXT = { service: 'youtube-oauth' };

function defaultRedirectUri() {
  return process.env.YOUTUBE_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social/connect/youtube/callback`;
}

class YouTubeOAuthService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.supabase = null;
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('YouTube OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET', LOG_CONTEXT);
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
    const s = process.env.YOUTUBE_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  getAuthorizationUrl(state) {
    if (!this.isConfigured()) throw new Error('YouTube OAuth not configured');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
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
    const supabase = this.getSupabaseClient();
    const accountData = {
      user_id: userId,
      platform: 'youtube',
      platform_user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar: profile.avatar,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      is_connected: true,
      metadata: {
        ...profile.metadata,
        connected_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('platform_accounts')
      .upsert(accountData, { onConflict: 'user_id,platform' })
      .select()
      .single();

    if (error) {
      logger.error('YouTube connect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return data;
  }

  async getConnectedAccounts(userId) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('platform_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .eq('is_connected', true);

    if (error) {
      logger.error('YouTube get connected accounts error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return data || [];
  }

  async disconnectAccount(userId, platformUserId) {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('platform_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .eq('platform_user_id', platformUserId);

    if (error) {
      logger.error('YouTube disconnect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return { success: true };
  }
}

module.exports = new YouTubeOAuthService();
