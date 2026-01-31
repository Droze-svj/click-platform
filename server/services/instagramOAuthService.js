// Instagram OAuth Service
// Features: Basic Display API, long-lived token exchange, platform_accounts storage.

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.instagram.com';
const DEFAULT_SCOPE = 'user_profile,user_media';
const LOG_CONTEXT = { service: 'instagram-oauth' };

function defaultRedirectUri() {
  return process.env.INSTAGRAM_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social/connect/instagram/callback`;
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

  getAuthorizationUrl(state) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
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
    const supabase = this.getSupabaseClient();
    const accountData = {
      user_id: userId,
      platform: 'instagram',
      platform_user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar: profile.avatar,
      access_token: tokens.access_token,
      refresh_token: null,
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
      logger.error('Instagram connect account error', { ...LOG_CONTEXT, userId, error: error.message });
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
      .eq('platform', 'instagram')
      .eq('is_connected', true);

    if (error) {
      logger.error('Instagram get connected accounts error', { ...LOG_CONTEXT, userId, error: error.message });
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
      .eq('platform', 'instagram')
      .eq('platform_user_id', platformUserId);

    if (error) {
      logger.error('Instagram disconnect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return { success: true };
  }
}

module.exports = new InstagramOAuthService();
