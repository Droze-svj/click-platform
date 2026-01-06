// Google OAuth Service

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { retryWithBackoff } = require('../utils/retryWithBackoff');

/**
 * Check if Google OAuth is configured
 */
function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'openid email profile';
    const clientId = process.env.GOOGLE_CLIENT_ID;

    const authUrl = `https://accounts.google.com/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `state=${state}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    // Store state in user's OAuth data
    const { data: currentUser } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

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
            google: {
              ...googleData,
              state: state
            }
          }
        }
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to store OAuth state: ${updateError.message}`);
    }

    return { url: authUrl, state };
  } catch (error) {
    logger.error('Google OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    // Verify state
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    const oauthData = user?.social_links?.oauth || {};
    const googleData = oauthData.google || {};

    if (userError || !user || !googleData.state || googleData.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/google/callback`;

    // Exchange code for token
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in, refresh_token, id_token } = response.data;

    // Decode ID token to get user info
    const userInfo = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());

    // Get additional profile info
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const profileData = profileResponse.data;

    // Save tokens to user
    const socialLinks = user.social_links || {};
    const oauthDataUpdated = socialLinks.oauth || {};
    const googleDataUpdated = oauthDataUpdated.google || {};

    const { error: saveError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauthDataUpdated,
            google: {
              ...googleDataUpdated,
              accessToken: access_token,
              refreshToken: refresh_token,
              connected: true,
              connectedAt: new Date().toISOString(),
              expiresAt: expires_in
                ? new Date(Date.now() + expires_in * 1000).toISOString()
                : null,
              platformUserId: userInfo.sub,
              platformUsername: profileData.name,
              email: profileData.email,
            }
          }
        }
      })
      .eq('id', userId);

    if (saveError) {
      throw new Error(`Failed to save OAuth tokens: ${saveError.message}`);
    }

    logger.info('Google OAuth token exchange successful', { userId });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      userInfo: {
        id: userInfo.sub,
        name: profileData.name,
        email: profileData.email,
        picture: profileData.picture,
      }
    };
  } catch (error) {
    logger.error('Google OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get Google client (for API calls)
 */
async function getGoogleClient(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauthData = user?.social_links?.oauth || {};
  const googleData = oauthData.google || {};

  if (error || !user || !googleData.connected || !googleData.accessToken) {
    throw new Error('Google account not connected');
  }

  // Check if token is expired and refresh if needed
  if (googleData.expiresAt && new Date() > new Date(googleData.expiresAt)) {
    if (googleData.refreshToken) {
      await refreshAccessToken(userId);
      // Reload user after refresh
      const { data: refreshedUser } = await supabase
        .from('users')
        .select('social_links')
        .eq('id', userId)
        .single();
      const refreshedOauth = refreshedUser?.social_links?.oauth || {};
      return refreshedOauth.google?.accessToken;
    } else {
      throw new Error('Google token expired and no refresh token available');
    }
  }

  return googleData.accessToken;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    const oauthData = user?.social_links?.oauth || {};
    const googleData = oauthData.google || {};

    if (error || !user || !googleData.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: googleData.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;

    // Update token in database
    const socialLinks = user.social_links || {};
    const oauthDataUpdated = socialLinks.oauth || {};
    const googleDataUpdated = oauthDataUpdated.google || {};

    const { error: updateError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauthDataUpdated,
            google: {
              ...googleDataUpdated,
              accessToken: access_token,
              expiresAt: expires_in
                ? new Date(Date.now() + expires_in * 1000).toISOString()
                : null,
            }
          }
        }
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update refresh token: ${updateError.message}`);
    }

    logger.info('Google token refreshed', { userId });
    return access_token;
  } catch (error) {
    logger.error('Google token refresh error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Disconnect Google account
 */
async function disconnectGoogle(userId) {
  try {
    // Get current oauth data from social_links
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch user: ${fetchError.message}`);
    }

    // Remove google from oauth in social_links
    const socialLinks = user.social_links || {};
    const oauthData = socialLinks.oauth || {};
    const { google, ...remainingOauth } = oauthData;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: remainingOauth
        }
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to disconnect Google: ${updateError.message}`);
    }

    logger.info('Google account disconnected', { userId });
  } catch (error) {
    logger.error('Google disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getGoogleClient,
  refreshAccessToken,
  disconnectGoogle,
};
