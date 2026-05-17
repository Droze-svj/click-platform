/**
 * Foundation Social Media Service
 * Provides a unified interface for platform-specific interactions
 */

const logger = require('../utils/logger');
const OAuthService = require('./oauthService');
const { isDevUser } = require('../utils/devUser');

/**
 * Main posting function to dispatch to platform-specific handlers
 */
async function postToSocialMedia(userId, platform, contentData, options = {}) {
  const Content = require('../models/Content');
  const contentId = options.contentId;
  
  try {
    let { title, description, mediaUrl, tags = [], targetLang = 'en' } = contentData;
    
    // Default to mock data if in dev mode
    const isDev = isDevUser(userId);

    if (isDev) {
      logger.info(`[DevMode] Mocking social post to ${platform}`);
      return {
        success: true,
        platform,
        externalId: `mock-post-${Date.now()}`,
        postUrl: `https://${platform}.com/mock-post-${Date.now()}`
      };
    }

    // 🌍 Phase 15: Localized Metadata Injection
    if (targetLang && targetLang !== 'en' && contentId) {
      const content = await Content.findById(contentId);
      if (content?.metadata?.translations?.[targetLang]) {
        logger.info(`Phase 15: Injecting localized metadata for ${targetLang}`);
        const translation = content.metadata.translations[targetLang];
        description = translation.description || description;
        title = translation.title || title;
        
        // Update contentData with translated values so they are used in dispatch
        contentData.title = title;
        contentData.description = description;
      }
    }

    // Check user's OAuth tokens for the platform — pass through the
    // caller-supplied accountId so multi-account users post from the
    // right token. `accountId === null` resolves to the active/primary
    // account, matching the previous single-account behaviour.
    const authData = await OAuthService.getSocialCredentials(userId, platform, options.accountId || null);

    if (!authData && process.env.NODE_ENV === 'production') {
      throw new Error(`Account not linked for platform: ${platform}`);
    }

    // Default to mock data if no auth found in non-prod
    const finalAuth = authData || { accessToken: 'dev-token' };

    // Dispatch with recursive recovery logic
    const result = await dispatchWithRecovery(userId, platform, finalAuth, contentData, false, options);

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
 * Connect social media account
 */
async function connectAccount(userId, platform, accessToken, refreshToken, metadata = {}) {
  try {
    const isDev = isDevUser(userId);
    if (isDev) {
      logger.info(`[DevMode] Mocking account connection for ${platform}`);
      return { platform, connected: true };
    }

    await OAuthService.saveSocialCredentials(userId, platform, {
      accessToken,
      refreshToken,
      extra: metadata
    });

    return { platform, connected: true };
  } catch (error) {
    logger.error(`Failed to connect ${platform} account`, { userId, error: error.message });
    throw error;
  }
}

/**
 * Disconnect social media account
 */
async function disconnectAccount(userId, platform) {
  try {
    const isDev = isDevUser(userId);
    if (isDev) {
      logger.info(`[DevMode] Mocking account disconnection for ${platform}`);
      return { platform, disconnected: true };
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user || !user.oauth) return { platform, disconnected: true };

    const platformKey = platform.toLowerCase();
    if (user.oauth[platformKey]) {
      user.oauth[platformKey].connected = false;
      user.markModified('oauth');
      await user.save();
    }

    return { platform, disconnected: true };
  } catch (error) {
    logger.error(`Failed to disconnect ${platform} account`, { userId, error: error.message });
    throw error;
  }
}

/**
 * Get connected accounts
 */
async function getConnectedAccounts(userId) {
  try {
    const isDev = isDevUser(userId);
    if (isDev) {
      logger.info(`[DevMode] Returning mock connected accounts for ${userId}`);
      return [
        { platform: 'tiktok', connected: true },
        { platform: 'instagram', connected: true }
      ];
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user || !user.oauth) return [];

    return Object.entries(user.oauth)
      .filter(([, data]) => data.connected)
      .map(([platform]) => ({ platform, connected: true }));
  } catch (error) {
    logger.error('Failed to get connected accounts', { userId, error: error.message });
    return [];
  }
}

/**
 * Get optimal posting times
 */
async function getOptimalPostingTimes(userId, platform) {
  try {
    const { NICHE_POSTING_WINDOWS } = require('./marketingKnowledge');
    const Content = require('../models/Content');
    
    // In dev mode or for users with no content, return general defaults
    const isDev = isDevUser(userId);
    let niche = 'business';

    if (!isDev) {
      const lastContent = await Content.findOne({ userId }).sort({ createdAt: -1 });
      niche = lastContent?.niche || lastContent?.metadata?.niche || 'business';
    }

    const windows = NICHE_POSTING_WINDOWS[niche]?.[platform.toLowerCase()] || 
                    NICHE_POSTING_WINDOWS['business'][platform.toLowerCase()] || [];

    return {
      platform,
      niche,
      optimalTimes: windows,
      timezone: 'UTC' // Default
    };
  } catch (error) {
    logger.error('Failed to get optimal posting times', { userId, platform, error: error.message });
    return { platform, optimalTimes: [], error: error.message };
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId, platform) {
  try {
    const isDev = isDevUser(userId);
    if (isDev) {
      logger.info(`[DevMode] Mocking token refresh for ${platform}`);
      return { accessToken: 'new-dev-token' };
    }

    const platformKey = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
    const refreshService = require(`./${platformKey}OAuthService`);
    
    if (refreshService && typeof refreshService.refreshAccessToken === 'function') {
      const newToken = await refreshService.refreshAccessToken(userId);
      return { accessToken: newToken };
    }
    
    throw new Error(`Refresh service not implemented for ${platform}`);
  } catch (error) {
    logger.error(`Token refresh failed for ${platform}`, { userId, error: error.message });
    throw error;
  }
}

/**
 * Dispatcher with built-in 401 retry / token refresh
 */
async function dispatchWithRecovery(userId, platform, auth, contentData, isRetry = false, options = {}) {
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
      logger.warn(`Auth failure for ${platform}. Attempting reactive token refresh...`, { userId, accountId: options?.accountId || null });
      try {
        const platformKey = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
        const refreshService = require(`./${platformKey}OAuthService`);

        // Refresh the *specific* account's token, not just the primary,
        // so the retry uses the right credentials when the user has
        // multiple accounts.
        const newAccessToken = typeof refreshService.refreshAccessToken === 'function'
          ? await refreshService.refreshAccessToken(userId, options?.accountId || undefined)
          : null;
        logger.info(`Reactive refresh successful for ${platform}. Retrying dispatch...`);

        return await dispatchWithRecovery(userId, platform, { accessToken: newAccessToken }, contentData, true, options);
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
    const connectedAccounts = await getConnectedAccounts(userId);
    const results = {};

    for (const { platform } of connectedAccounts) {
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
      return await require('./MetaSocialService').deletePost(finalAuth, externalId);
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
  postToSocialMedia,
  connectAccount,
  disconnectAccount,
  getConnectedAccounts,
  getOptimalPostingTimes,
  refreshAccessToken,
  syncSocialInsights,
  deleteFromSocial
};
