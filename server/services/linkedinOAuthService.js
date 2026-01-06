// LinkedIn OAuth Service

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
 * Check if LinkedIn OAuth is configured
 */
function isConfigured() {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!isConfigured()) {
      throw new Error('LinkedIn OAuth not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'openid profile email w_member_social';
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `state=${state}&` +
      `scope=${encodeURIComponent(scope)}`;

    // Store state in user's social_links (using as OAuth storage)
    const { data: currentUser } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    const socialLinks = currentUser?.social_links || {};
    const oauthData = socialLinks.oauth || {};
    const linkedinData = oauthData.linkedin || {};

    const { error: updateError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauthData,
            linkedin: {
              ...linkedinData,
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
    logger.error('LinkedIn OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!isConfigured()) {
      throw new Error('LinkedIn OAuth not configured');
    }

    // Verify state
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();

    const oauthData = user?.social_links?.oauth || {};
    const linkedinData = oauthData.linkedin || {};

    if (userError || !user || !linkedinData.state || linkedinData.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_CALLBACK_URL || 
      `${process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/linkedin/callback`;

    // Exchange code for token
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
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

    const { access_token, expires_in, refresh_token } = response.data;

    // Get user info
    const userInfo = await getLinkedInUserInfo(access_token);

    // Save tokens to user (using social_links for OAuth data)
    const socialLinks = user.social_links || {};
    const oauthData = socialLinks.oauth || {};
    const linkedinData = oauthData.linkedin || {};

    const { error: saveError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauthData,
            linkedin: {
              ...linkedinData,
              accessToken: access_token,
              refreshToken: refresh_token,
              connected: true,
              connectedAt: new Date().toISOString(),
              expiresAt: expires_in
                ? new Date(Date.now() + expires_in * 1000).toISOString()
                : null,
              platformUserId: userInfo.id,
              platformUsername: userInfo.name,
            }
          }
        }
      })
      .eq('id', userId);

    if (saveError) {
      throw new Error(`Failed to save OAuth tokens: ${saveError.message}`);
    }

    logger.info('LinkedIn OAuth token exchange successful', { userId });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    };
  } catch (error) {
    logger.error('LinkedIn OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get LinkedIn user info
 */
async function getLinkedInUserInfo(accessToken) {
  try {
    const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return {
      id: response.data.sub,
      name: response.data.name,
      email: response.data.email,
      picture: response.data.picture,
    };
  } catch (error) {
    logger.error('LinkedIn user info error', { error: error.message });
    throw error;
  }
}

/**
 * Get LinkedIn client (for API calls)
 */
async function getLinkedInClient(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('social_links')
    .eq('id', userId)
    .single();

  const oauthData = user?.social_links?.oauth || {};
  const linkedinData = oauthData.linkedin || {};

  if (error || !user || !linkedinData.connected || !linkedinData.accessToken) {
    throw new Error('LinkedIn account not connected');
  }

  // Check if token is expired and refresh if needed
  if (linkedinData.expiresAt && new Date() > new Date(linkedinData.expiresAt)) {
    if (linkedinData.refreshToken) {
      await refreshAccessToken(userId);
      // Reload user after refresh
      const { data: refreshedUser } = await supabase
        .from('users')
        .select('social_links')
        .eq('id', userId)
        .single();
      const refreshedOauth = refreshedUser?.social_links?.oauth || {};
      return refreshedOauth.linkedin?.accessToken;
    } else {
      throw new Error('LinkedIn token expired and no refresh token available');
    }
  }

  return linkedinData.accessToken;
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
    const linkedinData = oauthData.linkedin || {};

    if (error || !user || !linkedinData.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: user.oauth.linkedin.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in, refresh_token } = response.data;

    const socialLinks = user.social_links || {};
    const oauthData = socialLinks.oauth || {};
    const linkedinData = oauthData.linkedin || {};

    const { error: updateError } = await supabase
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauthData,
            linkedin: {
              ...linkedinData,
              accessToken: access_token,
              refreshToken: refresh_token || linkedinData.refreshToken,
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

    logger.info('LinkedIn token refreshed', { userId });
    return access_token;
  } catch (error) {
    logger.error('LinkedIn token refresh error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Post to LinkedIn
 */
async function postToLinkedIn(userId, text, options = {}, retries = 1) {
  try {
    const accessToken = await getLinkedInClient(userId);
    
    // Get user's URN
    const userInfo = await getLinkedInUserInfo(accessToken);
    const authorUrn = `urn:li:person:${userInfo.id}`;

    // Create post data
    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add media if provided
    if (options.mediaUrl) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        description: {
          text: text.substring(0, 200),
        },
        media: options.mediaUrl,
        title: {
          text: options.title || 'Shared via Click',
        },
      }];
    }

    const response = await retryWithBackoff(
      async () => {
        return await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
      },
      {
        maxRetries: retries,
        initialDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn('LinkedIn post retry', { attempt, error: error.message, userId });
        },
      }
    );

    logger.info('LinkedIn post successful', { userId, postId: response.data.id });
    
    return {
      id: response.data.id,
      url: `https://www.linkedin.com/feed/update/${response.data.id}`,
      text: text,
    };
  } catch (error) {
    logger.error('LinkedIn post error', { error: error.message, userId });
    
    // If token expired, try to refresh and retry
    if (error.response?.status === 401 && retries > 0) {
      try {
        await refreshAccessToken(userId);
        return await postToLinkedIn(userId, text, options, retries - 1);
      } catch (refreshError) {
        throw new Error('Token refresh failed. Please reconnect your LinkedIn account.');
      }
    }
    
    throw error;
  }
}

/**
 * Disconnect LinkedIn account
 */
async function disconnectLinkedIn(userId) {
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

    // Remove linkedin from oauth in social_links
    const socialLinks = user.social_links || {};
    const oauthData = socialLinks.oauth || {};
    const { linkedin, ...remainingOauth } = oauthData;

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
      throw new Error(`Failed to disconnect LinkedIn: ${updateError.message}`);
    }

    logger.info('LinkedIn account disconnected', { userId });
  } catch (error) {
    logger.error('LinkedIn disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getLinkedInUserInfo,
  getLinkedInClient,
  refreshAccessToken,
  postToLinkedIn,
  disconnectLinkedIn,
};




