// OAuth service for social media platforms

const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Generate OAuth authorization URL for Twitter/X
 */
function getTwitterAuthUrl() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/twitter`;
  const state = crypto.randomBytes(32).toString('hex');

  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured');
  }

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

  return { authUrl, state };
}

/**
 * Exchange Twitter authorization code for access token
 */
async function exchangeTwitterToken(code, codeVerifier = 'challenge') {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/twitter`;

    const response = await axios.post('https://api.twitter.com/2/oauth2/token', null, {
      params: {
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
    };
  } catch (error) {
    logger.error('Twitter token exchange error', { error: error.message });
    captureException(error, { tags: { platform: 'twitter', operation: 'token_exchange' } });
    throw error;
  }
}

/**
 * Refresh Twitter access token
 */
async function refreshTwitterToken(refreshToken) {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    const response = await axios.post('https://api.twitter.com/2/oauth2/token', null, {
      params: {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: clientId,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in,
    };
  } catch (error) {
    logger.error('Twitter token refresh error', { error: error.message });
    captureException(error, { tags: { platform: 'twitter', operation: 'token_refresh' } });
    throw error;
  }
}

/**
 * Post to Twitter/X using API v2
 */
async function postToTwitter(accessToken, content, options = {}) {
  try {
    const client = new TwitterApi(accessToken);
    const rwClient = client.readWrite;

    const tweetData = {
      text: content.text || content,
    };

    // Add media if provided
    if (options.mediaIds && options.mediaIds.length > 0) {
      tweetData.media = { media_ids: options.mediaIds };
    }

    // Add reply if provided
    if (options.replyTo) {
      tweetData.reply = { in_reply_to_tweet_id: options.replyTo };
    }

    const tweet = await rwClient.v2.tweet(tweetData);

    return {
      postId: tweet.data.id,
      url: `https://twitter.com/i/web/status/${tweet.data.id}`,
      success: true,
      text: tweet.data.text,
    };
  } catch (error) {
    logger.error('Twitter post error', { error: error.message });
    captureException(error, { tags: { platform: 'twitter', operation: 'post' } });
    throw error;
  }
}

/**
 * Get Twitter user info
 */
async function getTwitterUserInfo(accessToken) {
  try {
    const client = new TwitterApi(accessToken);
    const user = await client.v2.me({
      'user.fields': ['username', 'name', 'profile_image_url'],
    });

    return {
      id: user.data.id,
      username: user.data.username,
      name: user.data.name,
      profileImageUrl: user.data.profile_image_url,
    };
  } catch (error) {
    logger.error('Twitter user info error', { error: error.message });
    captureException(error, { tags: { platform: 'twitter', operation: 'user_info' } });
    throw error;
  }
}

/**
 * Generate OAuth authorization URL for LinkedIn
 */
function getLinkedInAuthUrl() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/linkedin`;
  const state = crypto.randomBytes(32).toString('hex');
  const scope = 'openid profile email w_member_social';

  if (!clientId) {
    throw new Error('LinkedIn OAuth credentials not configured');
  }

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

  return { authUrl, state };
}

/**
 * Exchange LinkedIn authorization code for access token
 */
async function exchangeLinkedInToken(code) {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/linkedin`;

    const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
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
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token,
    };
  } catch (error) {
    logger.error('LinkedIn token exchange error', { error: error.message });
    captureException(error, { tags: { platform: 'linkedin', operation: 'token_exchange' } });
    throw error;
  }
}

/**
 * Post to LinkedIn
 */
async function postToLinkedIn(accessToken, content, options = {}) {
  try {
    // Get user's URN first
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const authorUrn = `urn:li:person:${userResponse.data.sub}`;

    // Create post
    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text || content,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return {
      postId: response.data.id,
      url: `https://www.linkedin.com/feed/update/${response.data.id}`,
      success: true,
    };
  } catch (error) {
    logger.error('LinkedIn post error', { error: error.message });
    captureException(error, { tags: { platform: 'linkedin', operation: 'post' } });
    throw error;
  }
}

/**
 * Generate OAuth authorization URL for Facebook/Instagram
 */
function getFacebookAuthUrl() {
  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/facebook`;
  const state = crypto.randomBytes(32).toString('hex');
  const scope = 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management';

  if (!clientId) {
    throw new Error('Facebook OAuth credentials not configured');
  }

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;

  return { authUrl, state };
}

/**
 * Exchange Facebook authorization code for access token
 */
async function exchangeFacebookToken(code) {
  try {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.APP_URL || process.env.FRONTEND_URL}/api/oauth/callback/facebook`;

    const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    // Get long-lived token
    const longLivedResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: response.data.access_token,
      },
    });

    return {
      accessToken: longLivedResponse.data.access_token,
      expiresIn: longLivedResponse.data.expires_in,
    };
  } catch (error) {
    logger.error('Facebook token exchange error', { error: error.message });
    captureException(error, { tags: { platform: 'facebook', operation: 'token_exchange' } });
    throw error;
  }
}

/**
 * Post to Facebook
 */
async function postToFacebook(accessToken, content, options = {}) {
  try {
    const pageId = options.pageId || 'me';
    const postData = {
      message: content.text || content,
    };

    if (options.link) {
      postData.link = options.link;
    }

    const response = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, postData, {
      params: {
        access_token: accessToken,
      },
    });

    return {
      postId: response.data.id,
      url: `https://www.facebook.com/${response.data.id}`,
      success: true,
    };
  } catch (error) {
    logger.error('Facebook post error', { error: error.message });
    captureException(error, { tags: { platform: 'facebook', operation: 'post' } });
    throw error;
  }
}

/**
 * Post to Instagram (requires Facebook page connection)
 */
async function postToInstagram(accessToken, content, options = {}) {
  try {
    // Instagram posting requires a Facebook page and Instagram Business account
    // This is a simplified version - full implementation requires more setup
    const instagramAccountId = options.instagramAccountId;

    if (!instagramAccountId) {
      throw new Error('Instagram account ID required');
    }

    // Create media container first
    const mediaResponse = await axios.post(`https://graph.facebook.com/v18.0/${instagramAccountId}/media`, {
      image_url: options.imageUrl,
      caption: content.text || content,
      access_token: accessToken,
    });

    // Then publish
    const publishResponse = await axios.post(`https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`, {
      creation_id: mediaResponse.data.id,
      access_token: accessToken,
    });

    return {
      postId: publishResponse.data.id,
      url: `https://www.instagram.com/p/${publishResponse.data.id}`,
      success: true,
    };
  } catch (error) {
    logger.error('Instagram post error', { error: error.message });
    captureException(error, { tags: { platform: 'instagram', operation: 'post' } });
    throw error;
  }
}

module.exports = {
  // Twitter
  getTwitterAuthUrl,
  exchangeTwitterToken,
  refreshTwitterToken,
  postToTwitter,
  getTwitterUserInfo,
  
  // LinkedIn
  getLinkedInAuthUrl,
  exchangeLinkedInToken,
  postToLinkedIn,
  
  // Facebook/Instagram
  getFacebookAuthUrl,
  exchangeFacebookToken,
  postToFacebook,
  postToInstagram,
};






