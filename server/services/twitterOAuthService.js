// Twitter/X OAuth Service for Supabase

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Twitter OAuth 2.0 Configuration
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI ||
  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social/connect/twitter/callback`;

class TwitterOAuthService {
  constructor() {
    this.clientId = TWITTER_CLIENT_ID;
    this.clientSecret = TWITTER_CLIENT_SECRET;
    this.redirectUri = TWITTER_REDIRECT_URI;
    this.supabase = null;
    this.isConfiguredFlag = !!(this.clientId && this.clientSecret);

    if (this.isConfiguredFlag) {
      logger.info('✅ Twitter OAuth client initialized');
    } else {
      logger.warn('⚠️ Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET');
    }
  }

  getSupabaseClient() {
    if (!this.supabase) {
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

  getAuthorizationUrl(state) {
    if (!this.isConfigured()) {
      throw new Error('Twitter OAuth not configured');
    }

    const baseUrl = 'https://twitter.com/i/oauth2/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state: state,
      code_challenge: 'challenge',
      code_challenge_method: 'plain'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    if (!this.isConfigured()) {
      throw new Error('Twitter OAuth not configured');
    }

    try {
      const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          redirect_uri: this.redirectUri,
          code_verifier: 'challenge'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Twitter OAuth token exchange failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Twitter OAuth token exchange error:', error);
      throw error;
    }
  }

  async getUserProfile(accessToken) {
    try {
      const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,description,public_metrics', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
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
        following_count: data.data.public_metrics?.following_count
      };
    } catch (error) {
      console.error('Twitter API user profile error:', error);
      throw error;
    }
  }

  async postTweet(accessToken, tweetText, mediaIds = []) {
    try {
      const tweetData = {
        text: tweetText
      };

      if (mediaIds && mediaIds.length > 0) {
        tweetData.media = {
          media_ids: mediaIds
        };
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tweetData)
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
        platform_post_url: `https://twitter.com/i/status/${data.data.id}`
      };
    } catch (error) {
      console.error('Twitter API tweet post error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    if (!this.isConfigured()) {
      throw new Error('Twitter OAuth not configured');
    }

    try {
      const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          client_id: this.clientId
        })
      });

      if (!response.ok) {
        throw new Error(`Twitter OAuth token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Twitter OAuth token refresh error:', error);
      throw error;
    }
  }

  async connectAccount(userId, tokens, profile) {
    try {
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
          connected_at: new Date().toISOString()
        }
      };

      const { data, error } = await supabase
        .from('platform_accounts')
        .upsert(accountData, {
          onConflict: 'user_id,platform'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Twitter connect account error:', error);
      throw error;
    }
  }

  async disconnectAccount(userId, platformUserId) {
    try {
      const supabase = this.getSupabaseClient();

      const { error } = await supabase
        .from('platform_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('platform', 'twitter')
        .eq('platform_user_id', platformUserId);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Twitter disconnect account error:', error);
      throw error;
    }
  }

  async getConnectedAccounts(userId) {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('platform_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'twitter')
        .eq('is_connected', true);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Twitter get connected accounts error:', error);
      throw error;
    }
  }
}

module.exports = new TwitterOAuthService();

