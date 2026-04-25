// Google OAuth Service
// Features: token refresh, state validation, Supabase storage, ID token decode, profile fetch.

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DEFAULT_SCOPE = 'openid email profile';
const LOG_CONTEXT = { service: 'google-oauth' };

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
    logger.info('Supabase client initialized in Google OAuth service');
  }
  return supabase;
}

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function defaultRedirectUri() {
  return process.env.GOOGLE_CALLBACK_URL ||
    `${process.env.FRONTEND_URL || process.env.API_URL || 'http://localhost:5001'}/api/oauth/google/callback`;
}

function getScope() {
  const s = process.env.GOOGLE_SCOPE;
  return (s && typeof s === 'string' && s.trim()) ? s.trim() : DEFAULT_SCOPE;
}

async function getAuthorizationUrl(userId, callbackUrl) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  if (!userId || !callbackUrl) throw new Error('userId and callbackUrl are required');

  const state = crypto.randomBytes(32).toString('hex');
  const scope = getScope();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const authUrl = `https://accounts.google.com/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(callbackUrl.trim())}&` +
    `state=${encodeURIComponent(state)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  const supabase = getSupabaseClient();
  const { data: currentUser, error: fetchErr } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  if (fetchErr) {
    logger.error('Google OAuth state storage fetch error', { ...LOG_CONTEXT, userId, error: fetchErr.message });
    throw new Error(`Failed to store OAuth state: ${fetchErr.message}`);
  }

  const socialLinks = currentUser?.social_links || {};
  const oauthData = socialLinks.oauth || {};
  const googleData = oauthData.google || {};

  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthData,
          google: { ...googleData, state },
        },
      },
    })
    .eq('id', userId);

  if (updateError) {
    logger.error('Google OAuth state storage update error', { ...LOG_CONTEXT, userId, error: updateError.message });
    throw new Error(`Failed to store OAuth state: ${updateError.message}`);
  }

  logger.info('Google OAuth authorization URL generated', { ...LOG_CONTEXT, userId });
  return { url: authUrl, state };
}

async function exchangeCodeForToken(userId, code, state) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  if (!userId || !code || !state) throw new Error('userId, code, and state are required');

  const supabase = getSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauthData = user?.social_links?.oauth || {};
  const googleData = oauthData.google || {};

  if (userError || !user || !googleData.state || googleData.state !== state) {
    logger.warn('Google OAuth exchange: state mismatch', { ...LOG_CONTEXT, userId });
    throw new Error('Invalid OAuth state');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = defaultRedirectUri();

  const response = await axios.post(
    TOKEN_URL,
    null,
    {
      params: {
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const { access_token, expires_in, refresh_token, id_token } = response.data;
  if (!access_token) throw new Error('Google did not return an access token');

  const userInfo = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
  const profileResponse = await axios.get(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profileData = profileResponse.data;

  const socialLinks = user.social_links || {};
  const oauthSave = socialLinks.oauth || {};
  const googleSave = oauthSave.google || {};

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  const { error: saveError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthSave,
          google: {
            ...googleSave,
            accessToken: access_token,
            refreshToken: refresh_token || googleSave.refreshToken,
            connected: true,
            connectedAt: new Date().toISOString(),
            expiresAt,
            platformUserId: userInfo.sub,
            platformUsername: profileData.name,
            email: profileData.email,
            state: undefined,
          },
        },
      },
    })
    .eq('id', userId);

  if (saveError) {
    logger.error('Google OAuth token save error', { ...LOG_CONTEXT, userId, error: saveError.message });
    throw new Error(`Failed to save OAuth tokens: ${saveError.message}`);
  }

  logger.info('Google OAuth token exchange successful', { ...LOG_CONTEXT, userId });
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    userInfo: {
      id: userInfo.sub,
      name: profileData.name,
      email: profileData.email,
      picture: profileData.picture,
    },
  };
}

function isTokenExpiredSoon(expiresAt) {
  if (!expiresAt) return false;
  return new Date() >= new Date(expiresAt);
}

async function getGoogleClient(userId) {
  if (!userId) throw new Error('userId is required');

  const supabase = getSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauth = user?.social_links?.oauth || {};
  const google = oauth.google || {};

  if (error || !user || !google.connected || !google.accessToken) {
    throw new Error('Google account not connected');
  }

  if (isTokenExpiredSoon(google.expiresAt)) {
    if (google.refreshToken) {
      return await refreshAccessToken(userId);
    }
    throw new Error('Google token expired. Please reconnect your account.');
  }

  return google.accessToken;
}

async function refreshAccessToken(userId) {
  if (!userId) throw new Error('userId is required');

  const supabase = getSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauth = user?.social_links?.oauth || {};
  const google = oauth.google || {};

  if (error || !user || !google.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your Google account.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const response = await axios.post(
    TOKEN_URL,
    null,
    {
      params: {
        grant_type: 'refresh_token',
        refresh_token: google.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const { access_token, expires_in } = response.data;
  if (!access_token) throw new Error('Google did not return an access token on refresh');

  const socialLinks = user.social_links || {};
  const oauthUpdate = socialLinks.oauth || {};
  const googleUpdate = oauthUpdate.google || {};

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      social_links: {
        ...socialLinks,
        oauth: {
          ...oauthUpdate,
          google: {
            ...googleUpdate,
            accessToken: access_token,
            expiresAt,
          },
        },
      },
    })
    .eq('id', userId);

  if (updateError) {
    logger.error('Google refresh token save error', { ...LOG_CONTEXT, userId, error: updateError.message });
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  logger.info('Google token refreshed', { ...LOG_CONTEXT, userId });
  return access_token;
}

async function disconnectGoogle(userId) {
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
  const { google, ...restOauth } = oauth;

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
    throw new Error(`Failed to disconnect Google: ${updateError.message}`);
  }

  logger.info('Google account disconnected', { ...LOG_CONTEXT, userId });
}

module.exports = {
  isConfigured,
  getScope,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getGoogleClient,
  refreshAccessToken,
  disconnectGoogle,
  defaultRedirectUri,
};
