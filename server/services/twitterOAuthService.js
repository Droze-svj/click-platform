// Twitter/X OAuth Service
// Features: OAuth 2.0, token refresh, tweet posting, media support, platform_accounts storage.

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const API_BASE = 'https://api.twitter.com/2';
const DEFAULT_SCOPE = 'tweet.read tweet.write users.read offline.access';
const LOG_CONTEXT = { service: 'twitter-oauth' };

function defaultRedirectUri() {
  return process.env.TWITTER_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social/connect/twitter/callback`;
}

class TwitterOAuthService {
  constructor() {
    this.clientId = process.env.TWITTER_CLIENT_ID;
    this.clientSecret = process.env.TWITTER_CLIENT_SECRET;
    this.redirectUri = defaultRedirectUri();
    this.supabase = null;
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);
    if (this.isConfiguredFlag) {
      logger.info('Twitter OAuth client initialized', LOG_CONTEXT);
    } else {
      logger.warn('Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET', LOG_CONTEXT);
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
    const s = process.env.TWITTER_SCOPE;
    return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
  }

  getAuthorizationUrl(state) {
    if (!this.isConfigured()) throw new Error('Twitter OAuth not configured');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.getScope(),
      state,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) throw new Error('Twitter OAuth not configured');
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code_verifier: 'challenge',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Twitter OAuth token exchange failed: ${response.status} - ${errorData}`);
    }
    return await response.json();
  }

  async getUserProfile(accessToken) {
    const response = await fetch(`${API_BASE}/users/me?user.fields=profile_image_url,description,public_metrics`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Twitter API user profile fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.data.id,
      username: data.data.username,
      display_name: data.data.name,
      avatar: data.data.profile_image_url,
      description: data.data.description,
      followers_count: data.data.public_metrics?.followers_count,
      following_count: data.data.public_metrics?.following_count,
    };
  }

  async postTweet(accessToken, tweetText, mediaIds = []) {
    const tweetData = { text: tweetText };
    if (mediaIds?.length > 0) {
      tweetData.media = { media_ids: mediaIds };
    }

    const response = await fetch(`${API_BASE}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Twitter API tweet post failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    return {
      id: data.data.id,
      text: data.data.text,
      created_at: data.data.created_at,
      platform_post_url: `https://twitter.com/i/status/${data.data.id}`,
    };
  }

  async refreshToken(refreshToken) {
    if (!this.isConfigured()) throw new Error('Twitter OAuth not configured');
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Twitter OAuth token refresh failed: ${response.statusText}`);
    }
    return await response.json();
  }

  async connectAccount(userId, tokens, profile) {
    const supabase = this.getSupabaseClient();
    const accountData = {
      user_id: userId,
      platform: 'twitter',
      platform_user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar: profile.avatar,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      is_connected: true,
      metadata: {
        description: profile.description,
        followers_count: profile.followers_count,
        following_count: profile.following_count,
        connected_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('platform_accounts')
      .upsert(accountData, { onConflict: 'user_id,platform' })
      .select()
      .single();

    if (error) {
      logger.error('Twitter connect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return data;
  }

  async disconnectAccount(userId, platformUserId) {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('platform_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .eq('platform_user_id', platformUserId);

    if (error) {
      logger.error('Twitter disconnect account error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return { success: true };
  }

  async getConnectedAccounts(userId) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('platform_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .eq('is_connected', true);

    if (error) {
      logger.error('Twitter get connected accounts error', { ...LOG_CONTEXT, userId, error: error.message });
      throw error;
    }
    return data || [];
  }
}

module.exports = new TwitterOAuthService();
