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
  const translationService = require('./globalTranslationService');
  
  try {
    let { title, description, mediaUrl, tags = [], targetLang = 'en' } = contentData;
    
    // 🌍 Phase 15: Localized Metadata Injection
    if (targetLang && targetLang !== 'en' && contentId) {
      const content = await Content.findById(contentId);
      if (content?.metadata?.translations?.[targetLang]) {
        logger.info(`Phase 15: Injecting localized metadata for ${targetLang}`);
        const translation = content.metadata.translations[targetLang];
        // If we have a translated description/title in metadata, use it
        description = translation.description || description;
        title = translation.title || title;
      }
    }

    // 💰 Phase 17: Autonomous Affiliate Orchestration
    if (contentId) {
      const monetizationService = require('./monetizationService');
      const monetizationPlan = await monetizationService.getPlanByContent(userId, contentId);
      
      if (monetizationPlan && monetizationPlan.triggers && monetizationPlan.triggers.length > 0) {
        // Find the best trigger (highest intent score)
        const bestTrigger = [...monetizationPlan.triggers].sort((a, b) => b.intentScore - a.intentScore)[0];
        if (bestTrigger && bestTrigger.checkoutUrl) {
          description += `\n\n👉 Join ${bestTrigger.productName} here: ${bestTrigger.checkoutUrl}`;
          logger.info('Autonomous Affiliate: Injected link into description', { contentId, productId: bestTrigger.productId });
        }
      }
    }
    
    logger.info(`Dispatching post to ${platform}`, { userId, contentId, title, targetLang });

    // Check user's OAuth tokens for the platform
    const authData = await OAuthService.getSocialCredentials(userId, platform);
    
    if (!authData && process.env.NODE_ENV === 'production') {
      throw new Error(`Account not linked for platform: ${platform}`);
    }

    // Default to mock data if no auth found in non-prod
    const finalAuth = authData || { accessToken: 'dev-token' };

    // Dispatch with recursive recovery logic
    const result = await dispatchWithRecovery(userId, platform, finalAuth, contentData);

    // If contentId is provided, persist the post result to the Content model
    if (contentId && result.success) {
      await Content.findByIdAndUpdate(contentId, {
        $push: {
          'generatedContent.socialPosts': {
            platform,
            content: description,
            hashtags: tags,
            mediaUrl: mediaUrl,
            externalId: result.externalId,
            postUrl: result.postUrl,
            postedAt: new Date()
          }
        }
      });
      logger.info('Content model updated with social post result', { contentId, platform });
    }

    return result;
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
 * Dispatcher with built-in 401 retry / token refresh
 */
async function dispatchWithRecovery(userId, platform, auth, contentData, isRetry = false) {
  try {
    let result;
    switch (platform.toLowerCase()) {
    case 'tiktok':
      result = await require('./TikTokSocialService').postToTikTok(auth, contentData);
      break;
    case 'youtube':
      result = await require('./YouTubeSocialService').uploadToYouTube(auth, contentData);
      break;
    case 'twitter':
    case 'x':
      result = await require('./TwitterSocialService').postTweet(auth, contentData);
      break;
    case 'instagram':
      result = await require('./MetaSocialService').postToInstagram(auth, contentData);
      break;
    case 'facebook':
      result = await require('./MetaSocialService').postToFacebookPage(auth, contentData);
      break;
    case 'linkedin':
      result = await require('./LinkedInSocialService').postToLinkedIn(auth, contentData);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return {
      success: true,
      platform,
      externalId: result.id,
      postUrl: result.url
    };
  } catch (error) {
    const isAuthError = error.response?.status === 401 || error.message?.includes('expired') || error.message?.includes('auth');
    
    if (isAuthError && !isRetry) {
      logger.warn(`Auth failure for ${platform}. Attempting reactive token refresh...`, { userId });
      try {
        const platformKey = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
        const refreshService = require(`./${platformKey}OAuthService`);
        const refreshMethod = (platformKey === 'twitter' || platformKey === 'linkedin') ? 'refreshAccessToken' : 'refreshAccessToken'; // standard name
        
        const newAccessToken = await refreshService[refreshMethod](userId);
        logger.info(`Reactive refresh successful for ${platform}. Retrying dispatch...`);
        
        return await dispatchWithRecovery(userId, platform, { accessToken: newAccessToken }, contentData, true);
      } catch (refreshErr) {
        logger.error(`Reactive refresh failed for ${platform}`, { userId, error: refreshErr.message });
        throw error; // throw original 401
      }
    }
    throw error;
  }
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

/**
 * Delete a post from a social platform (Phase 18 Auto-Killer)
 */
async function deleteFromSocial(userId, platform, externalId) {
  try {
    const authData = await OAuthService.getSocialCredentials(userId, platform);
    if (!authData && process.env.NODE_ENV === 'production') {
      throw new Error(`Account not linked for deletion on platform: ${platform}`);
    }

    const finalAuth = authData || { accessToken: 'dev-token' };
    logger.info(`Phase 18 Auto-Killer: Deleting post ${externalId} from ${platform}`);

    switch (platform.toLowerCase()) {
    case 'tiktok':
      return await require('./TikTokSocialService').deletePost(finalAuth, externalId);
    case 'youtube':
      return await require('./YouTubeSocialService').deleteVideo(finalAuth, externalId);
    case 'twitter':
    case 'x':
      return await require('./TwitterSocialService').deleteTweet(finalAuth, externalId);
    case 'instagram':
      return await require('./MetaSocialService').deletePost(finalAuth, externalId); // if implemented
    case 'facebook':
      return await require('./MetaSocialService').deletePost(finalAuth, externalId);
    case 'linkedin':
      return { success: true, message: 'LinkedIn deletion staged' };
    default:
      throw new Error(`Deletion not supported for platform: ${platform}`);
    }
  } catch (error) {
    logger.error(`Auto-Killer: Deletion failed for ${platform}`, { userId, externalId, error: error.message });
    throw error;
  }
}


module.exports = {
  postToSocial,
  deleteFromSocial,
  syncSocialInsights
};
