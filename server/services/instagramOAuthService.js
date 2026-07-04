// Instagram OAuth Service
// Features: Basic Display API, long-lived token exchange, platform_accounts storage.

const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const OAuthService = require('./oauthService');
const OAuthStorage = require('../utils/oauthStorage');

// Supabase users have UUIDs; Mongoose User.findById throws CastError on them.
// Route UUID users through OAuthStorage; keep User.oauth.instagram for ObjectId users.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

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

    if (isMongoUserId(userId)) {
      // Legacy Mongo user — persist state to the User document.
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
      if (!user.oauth) user.oauth = {};
      if (!user.oauth.instagram) user.oauth.instagram = {};
      user.oauth.instagram.state = state;
      user.oauth.instagram.stateCreatedAt = new Date();
      user.markModified('oauth');
      await user.save();
    } else {
      // Supabase user (UUID) — persist via OAuthStorage (Supabase social_links).
      await OAuthStorage.saveTokens(userId, 'instagram', {
        state,
        stateCreatedAt: new Date().toISOString(),
      });
    }

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
    const accounts = await OAuthService.listSocialAccounts(userId, 'instagram');
    return accounts.map((a) => ({
      platform: 'instagram',
      accountId: a.accountId,
      platform_user_id: a.platformUserId,
      username: a.platformUsername,
      display_name: a.platformUsername,
      avatar: a.avatar,
      isPrimary: a.isPrimary,
      isActive: a.isActive,
      is_connected: true,
      connected_at: a.addedAt,
    }));
  }

  /**
   * Disconnect Instagram. Pass `accountId` to drop one of multiple
   * accounts; omit to disconnect every linked IG.
   */
  async disconnectAccount(userId, accountId = null) {
    const remaining = await OAuthService.removeSocialAccount(userId, 'instagram', accountId);
    logger.info('Instagram account disconnected', { userId, accountId, remaining });
    return { success: true, remaining };
  }

  /**
   * Return the Instagram Business / Creator accounts publishing-eligible
   * for this user. Falls back to the IG Basic Display account info if no
   * Facebook page is connected — that gives the UI something to show but
   * with `publishable: false` so callers know they can't post yet.
   */
  async getInstagramAccounts(userId) {
    const fbCreds = await OAuthService.getSocialCredentials(userId, 'facebook');
    if (fbCreds?.accessToken) {
      try {
        const url = `https://graph.facebook.com/v18.0/me/accounts?fields=name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}&access_token=${encodeURIComponent(fbCreds.accessToken)}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const accounts = (json?.data || [])
            .filter((p) => p?.instagram_business_account?.id)
            .map((p) => ({
              platform: 'instagram',
              platform_user_id: p.instagram_business_account.id,
              username: p.instagram_business_account.username,
              display_name: p.instagram_business_account.username,
              avatar: p.instagram_business_account.profile_picture_url || null,
              followers: p.instagram_business_account.followers_count ?? null,
              page_id: p.id,
              page_name: p.name,
              is_connected: true,
              publishable: true,
            }));
          if (accounts.length > 0) return accounts;
        }
      } catch (err) {
        logger.warn('Falling back to basic IG account info', { userId, error: err.message });
      }
    }

    // Basic Display fallback — user connected IG personal account directly.
    // Can be displayed in the UI but cannot publish.
    const basic = await this.getConnectedAccounts(userId);
    return basic.map((a) => ({ ...a, publishable: false }));
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

  /**
   * Resolve the user's Instagram Business Account ID + Facebook Page access
   * token. Posting through the Graph API requires both: the page token is
   * what authenticates the call, and the IG business id is the resource we
   * post under. We resolve in this order:
   *   1. Cached value on the IG OAuth row (if a previous post saved it)
   *   2. Cached value on the FB OAuth row (selected during onboarding)
   *   3. Live lookup via /me/accounts → first page with instagram_business_account
   */
  async resolveBusinessAccount(userId) {
    const igCreds = await OAuthService.getSocialCredentials(userId, 'instagram');
    const fbCreds = await OAuthService.getSocialCredentials(userId, 'facebook');

    // Prefer the page token over the IG user token: IG content publishing
    // is authenticated by the Facebook Page that owns the IG Business
    // account, not by the IG user token itself.
    const igBusinessId =
      igCreds?.businessAccountId ||
      igCreds?.instagramBusinessId ||
      fbCreds?.instagramBusinessId ||
      null;
    let pageAccessToken =
      igCreds?.pageAccessToken ||
      fbCreds?.pageAccessToken ||
      null;

    if (igBusinessId && pageAccessToken) {
      return { igBusinessId, pageAccessToken };
    }

    // Live lookup. Needs a Facebook user/page token with `pages_show_list`
    // + `instagram_basic` + `instagram_content_publish` granted.
    const fbToken = fbCreds?.accessToken;
    if (!fbToken) {
      throw new Error('Facebook account not connected. Instagram publishing requires a Facebook Page linked to an Instagram Business or Creator account.');
    }

    const pagesUrl = `${GRAPH_API_BASE.replace('graph.instagram.com', 'graph.facebook.com/v18.0')}/me/accounts?fields=name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`;
    const pagesRes = await fetch(pagesUrl);
    if (!pagesRes.ok) {
      const body = await pagesRes.text();
      throw new Error(`Facebook page lookup failed (${pagesRes.status}): ${body}`);
    }
    const pagesJson = await pagesRes.json();
    const pageWithIg = (pagesJson?.data || []).find((p) => p?.instagram_business_account?.id);
    if (!pageWithIg) {
      throw new Error('No Facebook Page on this account has an Instagram Business or Creator account linked. Convert your IG to Business and connect it to a Facebook Page, then reconnect.');
    }

    const resolved = {
      igBusinessId: pageWithIg.instagram_business_account.id,
      pageAccessToken: pageWithIg.access_token,
      pageId: pageWithIg.id,
      pageName: pageWithIg.name,
    };

    // Cache for subsequent posts so we don't burn a Graph API call each time.
    await OAuthService.saveSocialCredentials(userId, 'instagram', {
      accessToken: igCreds?.accessToken || null,
      refreshToken: igCreds?.refreshToken || null,
      extra: {
        businessAccountId: resolved.igBusinessId,
        pageAccessToken: resolved.pageAccessToken,
        pageId: resolved.pageId,
        pageName: resolved.pageName,
      },
    });

    return resolved;
  }

  /**
   * Publish to Instagram via the Graph API. Supports images, videos, reels,
   * and carousels. The IG Graph API is a two-step process: build a media
   * container, then publish it. For videos/reels we poll the container
   * until `status_code === 'FINISHED'` before publishing.
   *
   * options.dryRun and DRY_RUN_PUBLISH=true return a synthetic post id so
   * the queue can be exercised without hitting Facebook.
   */
  async postToInstagram(userId, mediaUrl, caption, options = {}) {
    const isDryRun = options?.dryRun || process.env.DRY_RUN_PUBLISH === 'true';
    if (isDryRun) {
      logger.info('Instagram dry-run post', { userId, mediaUrl, options });
      return {
        id: `ig_dry_${Date.now()}`,
        status: 'published',
        url: mediaUrl || null,
        dryRun: true,
      };
    }

    if (!mediaUrl) throw new Error('mediaUrl is required for Instagram posts');

    const { igBusinessId, pageAccessToken } = await this.resolveBusinessAccount(userId);
    const FB_BASE = 'https://graph.facebook.com/v18.0';

    // Detect media kind. Callers can override via options.mediaType.
    const looksVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl);
    const mediaType = options.mediaType || (options.isReel ? 'REELS' : (looksVideo ? 'VIDEO' : 'IMAGE'));

    // Step 1 — build the media container.
    const containerParams = new URLSearchParams();
    containerParams.set('access_token', pageAccessToken);
    if (caption) containerParams.set('caption', caption.slice(0, 2200)); // IG caption hard cap
    if (mediaType === 'IMAGE') {
      containerParams.set('image_url', mediaUrl);
    } else if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      containerParams.set('media_type', mediaType);
      containerParams.set('video_url', mediaUrl);
      if (options.coverUrl) containerParams.set('cover_url', options.coverUrl);
      if (options.shareToFeed === false) containerParams.set('share_to_feed', 'false');
    } else if (mediaType === 'CAROUSEL' && Array.isArray(options.children) && options.children.length > 0) {
      containerParams.set('media_type', 'CAROUSEL');
      containerParams.set('children', options.children.join(','));
    } else {
      throw new Error(`Unsupported Instagram media type: ${mediaType}`);
    }

    const containerRes = await fetch(`${FB_BASE}/${igBusinessId}/media?${containerParams.toString()}`, {
      method: 'POST',
    });
    if (!containerRes.ok) {
      const body = await containerRes.text();
      throw new Error(`Instagram media container creation failed (${containerRes.status}): ${body}`);
    }
    const containerJson = await containerRes.json();
    const creationId = containerJson.id;
    if (!creationId) throw new Error(`Instagram returned no creation_id: ${JSON.stringify(containerJson)}`);

    // Step 2 (videos/reels only) — poll until upload finishes processing.
    // Image containers are usable immediately. We cap at ~60s so a stuck
    // upload doesn't block the worker forever.
    if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      const startedAt = Date.now();
      const timeoutMs = Math.max(15000, Math.min(120000, options.processingTimeoutMs || 60000));
      while (Date.now() - startedAt < timeoutMs) {
        const statusRes = await fetch(`${FB_BASE}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(pageAccessToken)}`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.status_code === 'FINISHED') break;
          if (statusJson.status_code === 'ERROR') {
            throw new Error(`Instagram media processing failed: ${statusJson.status || 'unknown error'}`);
          }
        }
        // 3-second poll — generous enough to not rate-limit, fast enough
        // for short reels (which typically finish in 5-15s).
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Step 3 — publish the container.
    const publishRes = await fetch(`${FB_BASE}/${igBusinessId}/media_publish?creation_id=${encodeURIComponent(creationId)}&access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: 'POST',
    });
    if (!publishRes.ok) {
      const body = await publishRes.text();
      throw new Error(`Instagram media publish failed (${publishRes.status}): ${body}`);
    }
    const publishJson = await publishRes.json();
    const mediaId = publishJson.id;
    if (!mediaId) throw new Error(`Instagram returned no media id: ${JSON.stringify(publishJson)}`);

    // Pull the permalink so callers can render a clickable link in toasts.
    let permalink = null;
    try {
      const permRes = await fetch(`${FB_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(pageAccessToken)}`);
      if (permRes.ok) permalink = (await permRes.json()).permalink || null;
    } catch { /* permalink is nice-to-have */ }

    logger.info('Instagram post published', { userId, mediaId, mediaType });
    return {
      id: mediaId,
      platformPostId: mediaId,
      status: 'published',
      url: permalink,
      mediaType,
    };
  }

  /**
   * Reply to an Instagram comment as the connected business account.
   * `commentId` is the IG comment being replied to. Documented Graph API:
   * POST /{ig-comment-id}/replies?message=… with the page access token.
   * (Wired for the AI responder; only ever called when SOCIAL_REPLY_SEND=true.)
   */
  async replyToComment(userId, commentId, message) {
    if (!commentId) throw new Error('commentId is required');
    const { pageAccessToken } = await this.resolveBusinessAccount(userId);
    const params = new URLSearchParams();
    params.set('message', String(message || '').slice(0, 2200));
    params.set('access_token', pageAccessToken);
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(commentId)}/replies?${params.toString()}`,
      { method: 'POST', signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Instagram reply failed (${res.status}): ${body}`);
    }
    return res.json();
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
