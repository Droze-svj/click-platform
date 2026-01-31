// LinkedIn OAuth Service
// Form-body token requests, redirect_uri consistency, validation, refresh fixes.
// Features: getConnectionStatus, healthCheck, 429/Retry-After, redirect allow-list, image upload, logging.
// Additional: token/userInfo/image PUT wrapped with linkedInRequest, refresh return used in getClient,
// fetchImage retries, fallbackToTextOnImageError, healthCheck warnings, getConnectionStatus.expiresSoon.
// Further: state TTL (10m), configurable refresh buffer + request timeout, 5xx retries for token/refresh,
// healthCheck.supabaseConfigured + warning, getConnectionStatus.needsReconnect.
// More: 5xx exponential backoff, register/upload retryOn5xx, post 1300-char limit, redirect URI validation,
// linkedInError context + code mapping, hasRefreshToken, fetch timeout, optional LINKEDIN_DEBUG.

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
const ASSETS_REGISTER_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload';
const DEFAULT_REFRESH_BUFFER_SEC = 5 * 60;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_SCOPE = 'openid profile email w_member_social';
const LOG_CONTEXT = { service: 'linkedin-oauth' };

function getRefreshBufferSec() {
  const v = process.env.LINKEDIN_REFRESH_BUFFER_SEC;
  if (v == null || v === '') return DEFAULT_REFRESH_BUFFER_SEC;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : DEFAULT_REFRESH_BUFFER_SEC;
}

function getRequestTimeoutMs() {
  const v = process.env.LINKEDIN_REQUEST_TIMEOUT_MS;
  if (v == null || v === '') return DEFAULT_REQUEST_TIMEOUT_MS;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60000) : DEFAULT_REQUEST_TIMEOUT_MS;
}

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    logger.info('Supabase client initialized in LinkedIn OAuth service');
  }
  return supabase;
}

function isConfigured() {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

function getScope() {
  const s = process.env.LINKEDIN_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

function defaultRedirectUri(req) {
  if (process.env.LINKEDIN_CALLBACK_URL) return process.env.LINKEDIN_CALLBACK_URL;
  if (req && typeof req.get === 'function') {
    const protocol = req.protocol || 'https';
    const host = req.get('host');
    if (host) return `${protocol}://${host}/api/oauth/linkedin/callback`;
  }
  const base = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001';
  return base.replace(/\/$/, '') + '/api/oauth/linkedin/callback';
}

function getAllowedRedirectUris() {
  const raw = process.env.LINKEDIN_ALLOWED_REDIRECT_URIS;
  if (!raw || typeof raw !== 'string') return null;
  return raw.split(/[,\s;]+/).map((u) => u.trim()).filter(Boolean);
}

function isRedirectUriAllowed(callbackUrl) {
  const allowed = getAllowedRedirectUris();
  if (!allowed || allowed.length === 0) return true;
  const normalized = (callbackUrl || '').trim();
  return allowed.some((u) => u === normalized);
}

/** Basic URL validation for redirect_uri: must be https (or http for localhost) and have host. */
function isValidRedirectUri(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  try {
    const p = new URL(u);
    if (!p.hostname) return false;
    if (p.protocol !== 'https:' && p.protocol !== 'http:') return false;
    if (p.protocol === 'http:' && !/^localhost$|^127\.\d+\.\d+\.\d+$/.test(p.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Build form-urlencoded body for token requests (LinkedIn requires body, not query params).
 */
function tokenRequestBody(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

const LINKEDIN_ERROR_MESSAGES = {
  invalid_grant: 'Authorization expired or invalid. Please reconnect your LinkedIn account.',
  invalid_token: 'LinkedIn token invalid. Please reconnect your account.',
  unauthorized: 'LinkedIn access denied. Reconnect to continue.',
  invalid_request: 'Invalid request to LinkedIn. Check your connection settings.',
  insufficient_permissions: 'LinkedIn permissions insufficient. Reconnect and grant required access.',
  rate_limit_exceeded: 'LinkedIn rate limit exceeded. Please try again later.',
};

/**
 * Extract user-friendly error from LinkedIn API responses. Attach action/userId for debugging.
 */
function linkedInError(err, ctx = {}) {
  const data = err?.response?.data;
  const code = data?.error;
  const raw = data?.error_description || data?.error || data?.message || err?.message || 'LinkedIn API error';
  const msg = (code && LINKEDIN_ERROR_MESSAGES[code]) ? LINKEDIN_ERROR_MESSAGES[code] : raw;
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.linkedInCode = code;
  e.cause = err;
  if (ctx.userId != null) e.userId = ctx.userId;
  if (ctx.action) e.action = ctx.action;
  return e;
}

/**
 * LinkedIn HTTP client: retries on 429 (Retry-After) and optionally on 5xx, then throws linkedInError.
 */
async function linkedInRequest(fn, opts = {}) {
  const { userId, action = 'request', max429Retries = 2, retryOn5xx = false, max5xxRetries = 1 } = opts;
  const maxAttempts = 1 + max429Retries + (retryOn5xx ? max5xxRetries : 0);
  let lastErr;
  let done429 = 0;
  let done5xx = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 429 && done429 < max429Retries) {
        done429++;
        const raw = err?.response?.headers?.['retry-after'];
        const wait = Math.min(
          (typeof raw === 'string' ? parseInt(raw, 10) : raw) * 1000 || 60000,
          120000
        );
        logger.warn('LinkedIn rate limited (429), retrying after delay', {
          ...LOG_CONTEXT,
          userId,
          action,
          retryAfterMs: wait,
          attempt: attempt + 1,
        });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const is5xx = status >= 500 && status < 600;
      if (retryOn5xx && is5xx && done5xx < max5xxRetries) {
        done5xx++;
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        logger.warn('LinkedIn 5xx, retrying', {
          ...LOG_CONTEXT,
          userId,
          action,
          status,
          attempt: attempt + 1,
          delayMs: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw linkedInError(err, { userId, action });
    }
  }
  throw linkedInError(lastErr, { userId, action });
}

function isDebugEnabled() {
  return process.env.LINKEDIN_DEBUG === 'true' || process.env.LINKEDIN_DEBUG === '1';
}

function debugLog(action, meta = {}) {
  if (!isDebugEnabled()) return;
  logger.info('LinkedIn debug', { ...LOG_CONTEXT, action, ...meta });
}

/**
 * Generate OAuth authorization URL and store state + redirect_uri for exact reuse in token exchange.
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  if (!isConfigured()) {
    throw new Error('LinkedIn OAuth not configured');
  }
  if (!userId || !callbackUrl || typeof callbackUrl !== 'string') {
    throw new Error('userId and callbackUrl are required');
  }
  const url = callbackUrl.trim();
  if (!isValidRedirectUri(url)) {
    logger.warn('LinkedIn OAuth redirect URI invalid', { ...LOG_CONTEXT, userId });
    throw new Error('Redirect URI must be a valid https URL (or http for localhost) with host.');
  }
  if (!isRedirectUriAllowed(url)) {
    logger.warn('LinkedIn OAuth redirect URI not allowed', { ...LOG_CONTEXT, userId });
    throw new Error('Redirect URI is not allowed. Configure LINKEDIN_ALLOWED_REDIRECT_URIS.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  const scope = getScope();
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(url)}&` +
    `state=${encodeURIComponent(state)}&` +
    `scope=${encodeURIComponent(scope)}`;

  const supabase = getSupabaseClient();
  const { data: currentUser, error: fetchErr } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  if (fetchErr) {
    logger.error('LinkedIn OAuth state storage fetch error', { ...LOG_CONTEXT, userId, error: fetchErr.message });
    throw new Error(`Failed to store OAuth state: ${fetchErr.message}`);
  }

  const socialLinks = currentUser?.social_links || {};
  const oauthData = socialLinks.oauth || {};
  const linkedinData = oauthData.linkedin || {};

  const stateCreatedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthData,
          linkedin: {
            ...linkedinData,
            state,
            stateCreatedAt,
            redirectUri: url,
          },
        },
      },
    })
    .eq('id', userId);

  if (updateError) {
    logger.error('LinkedIn OAuth state storage update error', { ...LOG_CONTEXT, userId, error: updateError.message });
    throw new Error(`Failed to store OAuth state: ${updateError.message}`);
  }

  logger.info('LinkedIn OAuth authorization URL generated', { ...LOG_CONTEXT, userId, action: 'getAuthorizationUrl' });
  debugLog('getAuthorizationUrl', { userId });
  return { url: authUrl, state };
}

/**
 * Exchange authorization code for access token.
 * Uses redirect_uri stored at auth time so it matches exactly (LinkedIn requirement).
 */
async function exchangeCodeForToken(userId, code, state) {
  if (!isConfigured()) {
    throw new Error('LinkedIn OAuth not configured');
  }
  if (!userId || !code || !state) {
    throw new Error('userId, code, and state are required');
  }

  const supabase = getSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauthData = user?.social_links?.oauth || {};
  const linkedinData = oauthData.linkedin || {};

  if (userError || !user) {
    logger.warn('LinkedIn OAuth exchange: user fetch failed', { ...LOG_CONTEXT, userId, error: userError?.message });
    throw new Error('Invalid OAuth state');
  }
  if (!linkedinData.state || linkedinData.state !== state) {
    logger.warn('LinkedIn OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
    throw new Error('Invalid OAuth state');
  }
  const createdAt = linkedinData.stateCreatedAt ? new Date(linkedinData.stateCreatedAt).getTime() : 0;
  if (Date.now() - createdAt > STATE_TTL_MS) {
    logger.warn('LinkedIn OAuth exchange: state expired', { ...LOG_CONTEXT, userId });
    throw new Error('OAuth state expired. Please start the connection flow again.');
  }

  const redirectUri = linkedinData.redirectUri || defaultRedirectUri(null);

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const body = tokenRequestBody({
    grant_type: 'authorization_code',
    code: code.trim(),
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const timeout = getRequestTimeoutMs();
  const response = await linkedInRequest(
    () =>
      axios.post(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: (s) => s >= 200 && s < 300,
        timeout,
      }),
    { userId, action: 'exchangeCodeForToken', retryOn5xx: true, max5xxRetries: 1 }
  );

  const { access_token, expires_in, refresh_token } = response.data;
  if (!access_token) {
    throw new Error('LinkedIn did not return an access token');
  }

  const userInfo = await getLinkedInUserInfo(access_token, userId);
  const socialLinks = user.social_links || {};
  const oauthSave = socialLinks.oauth || {};
  const linkedinSave = oauthSave.linkedin || {};

  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000).toISOString()
    : null;

  const { error: saveError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthSave,
          linkedin: {
            ...linkedinSave,
            accessToken: access_token,
            refreshToken: refresh_token || linkedinSave.refreshToken,
            connected: true,
            connectedAt: new Date().toISOString(),
            expiresAt,
            platformUserId: userInfo.id,
            platformUsername: userInfo.name,
            state: undefined,
            stateCreatedAt: undefined,
            redirectUri: undefined,
          },
        },
      },
    })
    .eq('id', userId);

  if (saveError) {
    logger.error('LinkedIn OAuth token save error', { ...LOG_CONTEXT, userId, error: saveError.message });
    throw new Error(`Failed to save OAuth tokens: ${saveError.message}`);
  }

  logger.info('LinkedIn OAuth token exchange successful', { ...LOG_CONTEXT, userId, action: 'exchangeCodeForToken' });
  debugLog('exchangeCodeForToken', { userId });
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
  };
}

/**
 * Fetch LinkedIn user info. Optional userId enables rate-limit retries and logging.
 */
async function getLinkedInUserInfo(accessToken, userId = null) {
  if (!accessToken) throw new Error('Access token is required');
  const timeout = getRequestTimeoutMs();
  const doGet = () =>
    axios.get(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: (s) => s >= 200 && s < 300,
      timeout,
    });
  const res = userId
    ? await linkedInRequest(doGet, { userId, action: 'getLinkedInUserInfo' })
    : await doGet().catch((err) => {
        throw linkedInError(err);
      });
  const data = res.data;
  return {
    id: data.sub,
    name: data.name,
    email: data.email,
    picture: data.picture,
  };
}

function isTokenExpiredSoon(expiresAt) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  return Date.now() >= expires - getRefreshBufferSec() * 1000;
}

async function getLinkedInClient(userId) {
  if (!userId) throw new Error('userId is required');

  const supabase = getSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauth = user?.social_links?.oauth || {};
  const linkedin = oauth.linkedin || {};

  if (error || !user) {
    throw new Error('LinkedIn account not connected');
  }
  if (!linkedin.connected || !linkedin.accessToken) {
    throw new Error('LinkedIn account not connected');
  }

  if (isTokenExpiredSoon(linkedin.expiresAt)) {
    if (linkedin.refreshToken) {
      const newToken = await refreshAccessToken(userId);
      return newToken;
    }
    throw new Error('LinkedIn token expired. Please reconnect your account.');
  }

  return linkedin.accessToken;
}

/**
 * Refresh access token using refresh_token.
 * Uses form body (LinkedIn requirement). Fix: use stored linkedin data, not user.oauth.
 */
async function refreshAccessToken(userId) {
  if (!userId) throw new Error('userId is required');

  const supabase = getSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauth = user?.social_links?.oauth || {};
  const linkedin = oauth.linkedin || {};

  if (error || !user || !linkedin.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your LinkedIn account.');
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const body = tokenRequestBody({
    grant_type: 'refresh_token',
    refresh_token: linkedin.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const timeout = getRequestTimeoutMs();
  const response = await linkedInRequest(
    () =>
      axios.post(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: (s) => s >= 200 && s < 300,
        timeout,
      }),
    { userId, action: 'refreshAccessToken', retryOn5xx: true, max5xxRetries: 1 }
  );

  const { access_token, expires_in, refresh_token: newRefresh } = response.data;
  if (!access_token) {
    throw new Error('LinkedIn did not return an access token on refresh');
  }

  const socialLinks = user.social_links || {};
  const oauthUpdate = socialLinks.oauth || {};
  const linkedinUpdate = oauthUpdate.linkedin || {};

  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000).toISOString()
    : null;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthUpdate,
          linkedin: {
            ...linkedinUpdate,
            accessToken: access_token,
            refreshToken: newRefresh || linkedinUpdate.refreshToken,
            expiresAt,
          },
        },
      },
    })
    .eq('id', userId);

  if (updateError) {
    logger.error('LinkedIn refresh token save error', { ...LOG_CONTEXT, userId, error: updateError.message });
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  logger.info('LinkedIn token refreshed', { ...LOG_CONTEXT, userId, action: 'refreshAccessToken' });
  debugLog('refreshAccessToken', { userId });
  return access_token;
}

/**
 * Fetch image from URL and return { buffer, mimeType }. Retries on network/5xx.
 */
async function fetchImageFromUrl(imageUrl, maxRetries = 2) {
  const timeout = getRequestTimeoutMs();
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        maxContentLength: 10 * 1024 * 1024, // 10 MB
        timeout: Math.max(timeout, 15000),
        validateStatus: (s) => s >= 200 && s < 300,
      });
      const contentType = res.headers['content-type'] || '';
      const mime = contentType.split(';')[0].trim().toLowerCase();
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      const mimeType = allowed.includes(mime) ? mime : 'image/jpeg';
      return { buffer: res.data, mimeType };
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const isRetryable = !status || (status >= 500 && status < 600) || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';
      if (isRetryable && attempt < maxRetries) {
        const delay = (attempt + 1) * 1500;
        logger.warn('Image fetch retry', { ...LOG_CONTEXT, imageUrl: imageUrl?.substring?.(0, 80), attempt: attempt + 1, delayMs: delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(lastErr?.message || 'Failed to fetch image from URL');
    }
  }
  throw new Error(lastErr?.message || 'Failed to fetch image from URL');
}

/**
 * Register upload, PUT image, return asset URN. Uses v2 assets API (may be deprecated by LinkedIn).
 */
async function uploadImageToLinkedIn(accessToken, ownerPersonId, imageBuffer, mimeType, userId) {
  const ownerUrn = `urn:li:person:${ownerPersonId}`;
  const registerBody = {
    registerUploadRequest: {
      owner: ownerUrn,
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      serviceRelationships: [
        { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
      ],
      supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
    },
  };

  const timeout = getRequestTimeoutMs();
  debugLog('registerUpload', { userId });
  const reg = await linkedInRequest(
    () =>
      axios.post(ASSETS_REGISTER_URL, registerBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        validateStatus: (s) => s >= 200 && s < 300,
        timeout,
      }),
    { userId, action: 'registerUpload', retryOn5xx: true, max5xxRetries: 1 }
  );

  const value = reg.data?.value;
  const uploadUrl = value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = value?.asset;

  if (!uploadUrl || !asset) {
    throw new Error('LinkedIn image upload registration failed. Image posts may require API migration.');
  }

  await linkedInRequest(
    () =>
      axios.put(uploadUrl, imageBuffer, {
        headers: { 'Content-Type': mimeType },
        maxBodyLength: 10 * 1024 * 1024,
        validateStatus: (s) => s >= 200 && s < 300,
        timeout: getRequestTimeoutMs(),
      }),
    { userId, action: 'uploadImage', retryOn5xx: true, max5xxRetries: 1 }
  );

  return asset;
}

/**
 * Post to LinkedIn. Supports NONE, ARTICLE (link), or IMAGE (via options.imageUrl).
 */
const LINKEDIN_POST_COMMENTARY_MAX = 1300;

async function postToLinkedIn(userId, text, options = {}, retries = 1) {
  if (!userId) throw new Error('userId is required');
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Post text is required');
  }

  let commentary = text.trim();
  if (commentary.length > LINKEDIN_POST_COMMENTARY_MAX) {
    logger.warn('LinkedIn post commentary truncated', {
      ...LOG_CONTEXT,
      userId,
      originalLength: commentary.length,
      max: LINKEDIN_POST_COMMENTARY_MAX,
    });
    commentary = commentary.substring(0, LINKEDIN_POST_COMMENTARY_MAX - 3) + '...';
  }

  const accessToken = await getLinkedInClient(userId);
  const userInfo = await getLinkedInUserInfo(accessToken, userId);
  const authorUrn = `urn:li:person:${userInfo.id}`;

  const shareContent = {
    shareCommentary: { text: commentary },
    shareMediaCategory: 'NONE',
  };

  if (options.mediaUrl && options.mediaUrl.trim()) {
    shareContent.shareMediaCategory = 'ARTICLE';
    shareContent.media = [
      {
        status: 'READY',
        description: { text: (options.title || text).trim().substring(0, 200) },
        originalUrl: options.mediaUrl.trim(),
        title: { text: (options.title || 'Shared via Click').trim().substring(0, 200) },
      },
    ];
  } else if (options.imageUrl && options.imageUrl.trim()) {
    const fallbackToText = !!options.fallbackToTextOnImageError;
    try {
      const { buffer, mimeType } = await fetchImageFromUrl(options.imageUrl.trim());
      const assetUrn = await uploadImageToLinkedIn(
        accessToken,
        userInfo.id,
        buffer,
        mimeType,
        userId
      );
      shareContent.shareMediaCategory = 'IMAGE';
      shareContent.media = [
        {
          status: 'READY',
          media: assetUrn,
        },
      ];
    } catch (imgErr) {
      if (fallbackToText) {
        logger.warn('LinkedIn image upload failed, posting text-only', {
          ...LOG_CONTEXT,
          userId,
          error: imgErr?.message,
        });
        // shareMediaCategory remains 'NONE', shareCommentary already set
      } else {
        throw new Error(
          imgErr?.message || 'Image upload failed. Use a public image URL, post without image, or set fallbackToTextOnImageError.'
        );
      }
    }
  }

  const visibility = options.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC';
  const postData = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility,
    },
  };

  const timeout = getRequestTimeoutMs();
  const doPost = () =>
    axios.post(UGC_POSTS_URL, postData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      validateStatus: (s) => s >= 200 && s < 300,
      timeout,
    });

  let response;
  try {
    response = await linkedInRequest(doPost, {
      userId,
      action: 'postToLinkedIn',
      retryOn5xx: true,
      max5xxRetries: 1,
    });
  } catch (err) {
    if (err?.status === 401 && retries > 0) {
      try {
        await refreshAccessToken(userId);
        return await postToLinkedIn(userId, text, options, retries - 1);
      } catch (refreshErr) {
        throw new Error('Token refresh failed. Please reconnect your LinkedIn account.');
      }
    }
    throw err;
  }

  const id = response.data?.id;
  logger.info('LinkedIn post successful', { ...LOG_CONTEXT, userId, postId: id, action: 'postToLinkedIn' });
  debugLog('postToLinkedIn', { userId, postId: id });
  return {
    id,
    url: id ? `https://www.linkedin.com/feed/update/${id}` : null,
    text: commentary,
  };
}

async function disconnectLinkedIn(userId) {
  if (!userId) throw new Error('userId is required');

  const supabase = getSupabaseClient();
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch user: ${fetchError.message}`);
  }

  const socialLinks = user.social_links || {};
  const oauth = socialLinks.oauth || {};
  const { linkedin, ...restOauth } = oauth;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: restOauth,
      },
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Failed to disconnect LinkedIn: ${updateError.message}`);
  }

  logger.info('LinkedIn account disconnected', { ...LOG_CONTEXT, userId, action: 'disconnectLinkedIn' });
}

/**
 * Get connection status from Supabase (social_links.oauth.linkedin).
 */
async function getConnectionStatus(userId) {
  if (!userId) {
    return { connected: false, configured: isConfigured() };
  }
  try {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    const linkedin = user?.social_links?.oauth?.linkedin || {};
    const connected = !!(linkedin.connected && linkedin.accessToken);
    const expiresSoon = connected && isTokenExpiredSoon(linkedin.expiresAt);
    const hasRefresh = !!(linkedin.refreshToken);

    return {
      connected,
      configured: isConfigured(),
      platformUserId: linkedin.platformUserId || null,
      platformUsername: linkedin.platformUsername || null,
      expiresAt: linkedin.expiresAt || null,
      expiresSoon,
      hasRefreshToken: hasRefresh,
      needsReconnect: connected && expiresSoon && !hasRefresh,
      connectedAt: linkedin.connectedAt || null,
    };
  } catch (err) {
    logger.warn('LinkedIn getConnectionStatus failed', { ...LOG_CONTEXT, userId, error: err?.message });
    return { connected: false, configured: isConfigured() };
  }
}

/**
 * Health check: config present, Supabase, redirect allow-list, and optional warnings.
 */
function healthCheck() {
  const configured = isConfigured();
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const allowed = getAllowedRedirectUris();
  const hasAllowList = (allowed || []).length > 0;
  const warnings = [];
  if (configured && !supabaseConfigured) {
    warnings.push('LinkedIn OAuth requires Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) for token storage');
  }
  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL;
  if (configured && hasAllowList && callbackUrl && typeof callbackUrl === 'string') {
    const normalized = callbackUrl.trim();
    if (normalized && !allowed.some((u) => u === normalized)) {
      warnings.push('LINKEDIN_CALLBACK_URL is not in LINKEDIN_ALLOWED_REDIRECT_URIS');
    }
  }
  return {
    ok: configured && supabaseConfigured,
    configured,
    supabaseConfigured,
    scope: getScope(),
    hasRedirectAllowList: hasAllowList,
    ...(warnings.length > 0 && { warnings }),
  };
}

module.exports = {
  isConfigured,
  getScope,
  getAllowedRedirectUris,
  isRedirectUriAllowed,
  isValidRedirectUri,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getLinkedInUserInfo,
  getLinkedInClient,
  refreshAccessToken,
  postToLinkedIn,
  disconnectLinkedIn,
  getConnectionStatus,
  healthCheck,
  defaultRedirectUri,
};
