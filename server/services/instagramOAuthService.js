// Instagram OAuth Service — "Instagram API with Facebook Login".
//
// Instagram publishing only works for professional (Business/Creator) accounts
// linked to a Facebook Page, authorised through Facebook Login with Instagram
// permissions. This service used to drive the Instagram Basic Display API, which
// Meta shut down in December 2024 and which could never publish anyway.
//
// Flow: Facebook Login dialog (same Meta app as Facebook: FACEBOOK_APP_ID /
// FACEBOOK_APP_SECRET, or INSTAGRAM_CLIENT_ID / _SECRET if set) → long-lived
// user token → /me/accounts → each Page's linked instagram_business_account →
// store the IG account with the Page's access token (Page tokens from a
// long-lived user token do not expire) and { igUserId, pageId } metadata.

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { resolveOAuthCallbackUrl } = require('../utils/oauthCallbackUrl');
const OAuthService = require('./oauthService');
const OAuthStorage = require('../utils/oauthStorage');
const { GRAPH_BASE, DIALOG_BASE } = require('../utils/metaGraph');
const { publicMediaUrl } = require('../utils/publicMediaUrl');

// Supabase users have UUIDs; Mongoose User.findById throws CastError on them.
// Route UUID users through OAuthStorage; keep User.oauth.instagram for ObjectId users.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

const DEFAULT_SCOPE = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
].join(',');
const LOG_CONTEXT = { service: 'instagram-oauth' };

// Delegates to the shared resolver so the authorize step and the token
// exchange can never derive different values. Called per-use rather than
// cached at construction: the env is read at boot, but a resolver that
// depends on the request cannot be memoised into a constructor.
function defaultRedirectUri(req) {
  return resolveOAuthCallbackUrl('instagram', req);
}

class InstagramOAuthService {
  constructor() {
    if (this.isConfigured()) {
      logger.info('Instagram (Facebook Login) client initialized', LOG_CONTEXT);
    } else {
      logger.warn('Instagram OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET (the same Meta app as Facebook).', LOG_CONTEXT);
    }
  }

  // Read per use so a changed env (and tests) take effect without a restart.
  get clientId() {
    return process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_APP_ID || null;
  }

  get clientSecret() {
    return process.env.INSTAGRAM_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || null;
  }

  // Lazy, not snapshotted in the constructor: this module is required at boot,
  // and a value captured then would ignore any later env change (and would be
  // wrong for every test that sets one). It is only a fallback now — callers
  // pass the resolved callback URL explicitly.
  get redirectUri() {
    return defaultRedirectUri();
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
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
    return `${DIALOG_BASE}?${params.toString()}`;
  }

  // callbackUrl MUST be the same value the authorize step sent; the shared
  // callback route passes it from the signed state.
  async exchangeCodeForToken(code, callbackUrl) {
    if (!this.isConfigured()) throw new Error('Instagram OAuth not configured');
    const tokenParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: callbackUrl || this.redirectUri,
      code,
    });
    const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${tokenParams.toString()}`);
    if (!shortRes.ok) {
      const errorData = await shortRes.text();
      throw new Error(`Instagram (Facebook Login) token exchange failed: ${shortRes.status} - ${errorData}`);
    }
    const shortData = await shortRes.json();

    // Long-lived user token → Page tokens derived from it don't expire.
    let userToken = shortData.access_token;
    let expiresIn = shortData.expires_in || null;
    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      fb_exchange_token: shortData.access_token,
    });
    const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams.toString()}`);
    if (longRes.ok) {
      const longData = await longRes.json();
      if (longData.access_token) {
        userToken = longData.access_token;
        expiresIn = longData.expires_in || null;
      }
    }

    const igAccounts = await this.listLinkedAccounts(userToken);
    return { access_token: userToken, expires_in: expiresIn, igAccounts };
  }

  /**
   * Every Instagram professional account linked to a Page the user manages,
   * with that Page's access token. [] when none.
   */
  async listLinkedAccounts(userAccessToken) {
    const fields = 'id,name,access_token,instagram_business_account{id,username,profile_picture_url}';
    const res = await fetch(`${GRAPH_BASE}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Facebook Page lookup failed (${res.status}): ${body}`);
    }
    const json = await res.json();
    return (json?.data || [])
      .filter((p) => p?.instagram_business_account?.id && p.access_token)
      .map((p) => ({
        igUserId: p.instagram_business_account.id,
        username: p.instagram_business_account.username || null,
        avatar: p.instagram_business_account.profile_picture_url || null,
        pageId: p.id,
        pageName: p.name || null,
        pageAccessToken: p.access_token,
      }));
  }

  // The shared callback calls getUserProfile(tokens.access_token) and then
  // connectAccount(userId, tokens, profile). The profile is the first linked
  // IG account; connectAccount stores all of them.
  async getUserProfile(accessToken) {
    const accounts = await this.listLinkedAccounts(accessToken);
    return this._profileFrom(accounts);
  }

  _profileFrom(accounts) {
    if (!accounts || accounts.length === 0) {
      throw new Error('No Instagram professional account found. Switch your Instagram to a Business or Creator account, link it to a Facebook Page you manage, then connect again.');
    }
    const a = accounts[0];
    return { id: a.igUserId, username: a.username, display_name: a.username, avatar: a.avatar, metadata: { igUserId: a.igUserId, pageId: a.pageId, pageName: a.pageName } };
  }

  async connectAccount(userId, tokens, profile) {
    const accounts = Array.isArray(tokens.igAccounts) && tokens.igAccounts.length
      ? tokens.igAccounts
      : await this.listLinkedAccounts(tokens.access_token);
    if (!accounts.length) this._profileFrom(accounts); // throws the helpful message

    for (const a of accounts) {
      await OAuthService.saveSocialCredentials(userId, 'instagram', {
        // The Page token is what Instagram content publishing authenticates with.
        accessToken: a.pageAccessToken,
        refreshToken: null,
        extra: {
          platformUserId: a.igUserId,
          platformUsername: a.username,
          avatar: a.avatar,
          // Page tokens from a long-lived user token don't expire.
          expiresAt: null,
          metadata: { igUserId: a.igUserId, pageId: a.pageId, pageName: a.pageName },
        },
      });
    }
    logger.info('Instagram account(s) connected', { userId, count: accounts.length, primary: profile?.id || accounts[0].igUserId });
    return { success: true, platform: 'instagram', username: accounts[0].username };
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
        const url = `${GRAPH_BASE}/me/accounts?fields=name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}&access_token=${encodeURIComponent(fbCreds.accessToken)}`;
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
    // Instagram is authorised with a Facebook Page token, which does not expire
    // when it comes from a long-lived user token. Nothing to refresh; the Basic
    // Display refresh endpoint this used to call no longer exists.
    const creds = await OAuthService.getSocialCredentials(userId, 'instagram');
    if (!creds?.accessToken) throw new Error('Instagram not connected');
    return creds.accessToken;
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
  async resolveBusinessAccount(userId, accountId = null) {
    const igCreds = await OAuthService.getSocialCredentials(userId, 'instagram', accountId);
    // Connected through Facebook Login: the IG account id and its Page token
    // are stored on the account itself.
    if (igCreds?.accessToken && igCreds?.metadata?.igUserId) {
      return {
        igBusinessId: igCreds.metadata.igUserId,
        pageAccessToken: igCreds.accessToken,
        pageId: igCreds.metadata.pageId || null,
        pageName: igCreds.metadata.pageName || null,
      };
    }
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

    const pagesUrl = `${GRAPH_BASE}/me/accounts?fields=name,access_token,instagram_business_account&access_token=${encodeURIComponent(fbToken)}`;
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

    const { igBusinessId, pageAccessToken } = await this.resolveBusinessAccount(userId, options.accountId || null);
    return publishInstagramMedia({ igBusinessId, pageAccessToken, mediaUrl, caption, options, userId });
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
      `${GRAPH_BASE}/${encodeURIComponent(commentId)}/replies?${params.toString()}`,
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


/**
 * Create an Instagram media container, wait for video processing, publish it.
 * Shared by the direct route (postToInstagram) and the scheduler
 * (MetaSocialService.postToInstagram). Our own /uploads files are turned into
 * absolute signed URLs because Instagram downloads the media itself.
 */
async function publishInstagramMedia({ igBusinessId, pageAccessToken, mediaUrl, caption, options = {}, userId = null }) {
  if (!igBusinessId || !pageAccessToken) throw new Error('Instagram account not connected. Connect Instagram (through Facebook) again.');
  const FB_BASE = GRAPH_BASE;
  mediaUrl = publicMediaUrl(mediaUrl);
  // Detect media kind. Callers can override via options.mediaType.
  const looksVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl);
  // Instagram retired media_type=VIDEO for feed posts in 2023: every video is
  // published as a Reel (share_to_feed defaults to true, so it shows on the grid).
  const mediaType = options.mediaType || ((options.isReel || looksVideo) ? 'REELS' : 'IMAGE');

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

const instance = new InstagramOAuthService();
module.exports = instance;
module.exports.publishInstagramMedia = publishInstagramMedia;
