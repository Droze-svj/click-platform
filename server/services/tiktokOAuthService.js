// TikTok OAuth Service
// Features: OAuth 2.0, video upload/publish permissions, platform_accounts storage.

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

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
    this.supabase = null;
    this.isConfiguredFlag = !!(this.clientKey && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('TikTok OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET', LOG_CONTEXT);
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
    const supabase = this.getSupabaseClient();
    const accountData = {
      user_id: userId,
      platform: 'tiktok',
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
      logger.error('TikTok connect account error', { ...LOG_CONTEXT, userId, error: error.message });
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
      .eq('platform', 'tiktok')
      .eq('is_connected', true);

    if (error) {
      logger.error('TikTok get connected accounts error', { ...LOG_CONTEXT, userId, error: error.message });
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
      .eq('platform', 'tiktok')
      .eq('platform_user_id', platformUserId);

    if (error) {
      logger.error('TikTok disconnect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return { success: true };
  }
}

module.exports = new TikTokOAuthService();
