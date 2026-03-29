/**
 * Foundation Social Media Service
 * Provides a unified interface for platform-specific interactions
 */

const logger = require('../utils/logger');
const OAuthService = require('./OAuthService');

/**
 * Main posting function to dispatch to platform-specific handlers
 */
async function postToSocial(userId, platform, contentData, contentId = null) {
  const Content = require('../models/Content');
  try {
    const { title, description, mediaUrl, tags = [] } = contentData;
    
    logger.info(`Dispatching post to ${platform}`, { userId, contentId, title, hasMedia: !!mediaUrl });

    // Check user's OAuth tokens for the platform
    const authData = await OAuthService.getSocialCredentials(userId, platform);
    
    if (!authData && process.env.NODE_ENV === 'production') {
      throw new Error(`Account not linked for platform: ${platform}`);
    }

    // Default to mock data if no auth found in non-prod
    const finalAuth = authData || { accessToken: 'dev-token' };

    let result;
    switch (platform.toLowerCase()) {
      case 'tiktok':
        result = await require('./TikTokSocialService').postToTikTok(finalAuth, contentData);
        break;
      case 'youtube':
        result = await require('./YouTubeSocialService').uploadToYouTube(finalAuth, contentData);
        break;
      case 'twitter':
      case 'x':
        result = await require('./TwitterSocialService').postTweet(finalAuth, contentData);
        break;
      case 'instagram':
        result = await postToInstagram(finalAuth, contentData);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // If contentId is provided, persist the post result to the Content model
    if (contentId) {
      await Content.findByIdAndUpdate(contentId, {
        $push: {
          'generatedContent.socialPosts': {
            platform,
            content: description,
            hashtags: tags,
            mediaUrl: mediaUrl,
            externalId: result.id,
            postUrl: result.url,
            postedAt: new Date()
          }
        }
      });
      logger.info('Content model updated with social post result', { contentId, platform });
    }

    return {
      success: true,
      platform,
      externalId: result.id,
      postUrl: result.url,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error(`Social post failed for ${platform}`, { userId, contentId, error: error.message });
    return {
      success: false,
      platform,
      error: error.message
    };
  }
}

/**
 * Mock handlers for specific platforms
 */
async function postToInstagram(auth, content) {
  logger.info(`Posting to Instagram Graph API with token ${auth.accessToken.substring(0, 5)}...`);
  logger.debug('Content data:', { title: content.title });
  return { id: `ig_${Date.now()}`, url: `https://instagram.com/reel/dummy` };
}

/**
 * Synchronize social insights for a user across all connected platforms
 */
async function syncSocialInsights(userId) {
  try {
    const connectedAccounts = await OAuthService.getConnectedSocials(userId);
    const results = {};

    for (const platform of connectedAccounts) {
      try {
        const authData = await OAuthService.getSocialCredentials(userId, platform);
        let insights;

        switch (platform.toLowerCase()) {
          case 'youtube':
            insights = await require('./YouTubeSocialService').getChannelInsights(authData);
            break;
          case 'tiktok':
            insights = await require('./TikTokSocialService').getProfileInsights(authData);
            break;
          case 'twitter':
          case 'x':
            insights = await require('./TwitterSocialService').getUserInsights(authData);
            break;
          default:
            logger.warn(`Insights sync not supported for platform: ${platform}`);
            continue;
        }

        results[platform] = insights;
      } catch (err) {
        logger.error(`Failed to sync insights for ${platform}`, { userId, error: err.message });
      }
    }

    return {
      success: true,
      lastSync: new Date(),
      results
    };
  } catch (error) {
    logger.error('Global social sync failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  postToSocial,
  syncSocialInsights
};
