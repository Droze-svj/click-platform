// Social media integration service

const User = require('../models/User');
const ScheduledPost = require('../models/ScheduledPost');
const SocialConnection = require('../models/SocialConnection');
const logger = require('../utils/logger');
const {
  postToTwitter,
  refreshTwitterToken,
} = require('./oauthService');
const { postToLinkedIn: postToLinkedInDedicated } = require('./linkedinOAuthService');
const { postToFacebook: postToFacebookDedicated } = require('./facebookOAuthService');
const { postToInstagram: postToInstagramDedicated } = require('./instagramOAuthService');
const { uploadVideoToYouTube, postToYouTube: postToYouTubeDedicated } = require('./youtubeOAuthService');
const { uploadVideoToTikTok, postToTikTok: postToTikTokDedicated } = require('./tiktokOAuthService');

/**
 * Connect social media account
 */
async function connectAccount(userId, platform, accessToken, refreshToken, metadata = {}) {
  try {
    // Use SocialConnection model if available, otherwise fall back to User model
    if (SocialConnection) {
      const connection = await SocialConnection.findOneAndUpdate(
        { userId, platform },
        {
          userId,
          platform,
          accessToken,
          refreshToken,
          isActive: true,
          lastUsed: new Date(),
          metadata: metadata || {}
        },
        { upsert: true, new: true }
      );
      logger.info('Social media account connected', { userId, platform });
      return connection;
    } else {
      // Fallback to User model
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.socialConnections) {
        user.socialConnections = {};
      }

      user.socialConnections[platform] = {
        accessToken,
        refreshToken,
        connectedAt: new Date(),
        metadata,
        isActive: true
      };

      await user.save();
      logger.info('Social media account connected', { userId, platform });
      return user.socialConnections[platform];
    }
  } catch (error) {
    logger.error('Error connecting social media account', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Disconnect social media account
 */
async function disconnectAccount(userId, platform) {
  try {
    if (SocialConnection) {
      await SocialConnection.findOneAndUpdate(
        { userId, platform },
        { isActive: false }
      );
    } else {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.socialConnections && user.socialConnections[platform]) {
        user.socialConnections[platform].isActive = false;
        user.socialConnections[platform].disconnectedAt = new Date();
        await user.save();
      }
    }

    logger.info('Social media account disconnected', { userId, platform });
    return true;
  } catch (error) {
    logger.error('Error disconnecting social media account', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Get connected accounts
 */
async function getConnectedAccounts(userId) {
  try {
    if (SocialConnection) {
      const connections = await SocialConnection.find({
        userId,
        isActive: true
      }).select('platform platformUsername metadata createdAt');
      
      return connections.map(conn => ({
        platform: conn.platform,
        connectedAt: conn.createdAt,
        metadata: {
          username: conn.platformUsername,
          ...conn.metadata
        }
      }));
    } else {
      const user = await User.findById(userId).select('socialConnections');
      if (!user || !user.socialConnections) {
        return [];
      }

      const accounts = [];
      for (const [platform, connection] of Object.entries(user.socialConnections)) {
        if (connection.isActive) {
          accounts.push({
            platform,
            connectedAt: connection.connectedAt,
            metadata: connection.metadata
          });
        }
      }

      return accounts;
    }
  } catch (error) {
    logger.error('Error getting connected accounts', { error: error.message, userId });
    return [];
  }
}

/**
 * Post to social media
 */
async function postToSocialMedia(userId, platform, content, options = {}) {
  try {
    // Platform-specific posting logic (uses dedicated services)
    const result = await postToPlatform(platform, userId, content, options);
    
    // Create scheduled post record
    const scheduledPost = new ScheduledPost({
      userId,
      platform,
      content: {
        text: content.text || content.caption || '',
        mediaUrl: content.mediaUrl || options.imageUrl,
        hashtags: content.hashtags || []
      },
      scheduledTime: new Date(),
      status: 'posted',
      postedAt: new Date(),
      platformPostId: result.id || result.postId,
      platformPostUrl: result.url,
      engagement: 0
    });

    await scheduledPost.save();

    // Trigger webhook
    const { triggerWebhook } = require('./webhookService');
    await triggerWebhook(userId, 'post.posted', {
      postId: scheduledPost._id,
      contentId: content._id || content.contentId,
      platform,
      platformPostId: result.id || result.postId,
      platformPostUrl: result.url,
      postedAt: scheduledPost.postedAt
    });

    logger.info('Posted to social media', { userId, platform, postId: result.id || result.postId });
    return scheduledPost;
  } catch (error) {
    logger.error('Error posting to social media', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Platform-specific posting (uses dedicated OAuth services)
 */
async function postToPlatform(platform, userId, content, options) {
  switch (platform.toLowerCase()) {
    case 'twitter':
      // Twitter still uses accessToken directly
      const connection = await getConnection(userId, platform);
      return await postToTwitter(connection.accessToken, content, options);
    case 'linkedin':
      // LinkedIn uses dedicated service with userId
      return await postToLinkedInDedicated(userId, content.text || content, options);
    case 'facebook':
      // Facebook uses dedicated service with userId
      return await postToFacebookDedicated(userId, content.text || content, options);
    case 'instagram':
      // Instagram uses dedicated service with userId
      if (!content.imageUrl && !options.imageUrl) {
        throw new Error('Image URL is required for Instagram posts');
      }
      return await postToInstagramDedicated(
        userId, 
        content.imageUrl || options.imageUrl, 
        content.text || content.caption || '', 
        options
      );
    case 'youtube':
      // YouTube uses dedicated service with userId
      if (!content.videoFile && !content.videoUrl) {
        throw new Error('Video file or URL is required for YouTube posts');
      }
      if (content.videoFile) {
        return await uploadVideoToYouTube(
          userId,
          content.videoFile,
          content.title || content.text || 'Untitled',
          content.description || '',
          options
        );
      } else {
        return await postToYouTubeDedicated(
          userId,
          content.videoUrl,
          content.title || content.text || 'Untitled',
          content.description || '',
          options
        );
      }
    case 'tiktok':
      // TikTok uses dedicated service with userId
      if (!content.videoFile && !content.videoUrl) {
        throw new Error('Video file or URL is required for TikTok posts');
      }
      if (content.videoFile) {
        return await uploadVideoToTikTok(
          userId,
          content.videoFile,
          content.text || content.caption || '',
          options
        );
      } else {
        return await postToTikTokDedicated(
          userId,
          content.videoUrl,
          content.text || content.caption || '',
          options
        );
      }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get connection for a platform
 */
async function getConnection(userId, platform) {
  if (SocialConnection) {
    const connection = await SocialConnection.findOne({
      userId,
      platform,
      isActive: true
    });
    if (!connection) {
      throw new Error(`No active connection to ${platform}`);
    }
    return connection;
  } else {
    const user = await User.findById(userId);
    if (!user || !user.socialConnections || !user.socialConnections[platform] || !user.socialConnections[platform].isActive) {
      throw new Error(`No active connection to ${platform}`);
    }
    return user.socialConnections[platform];
  }
}

// Post functions are now imported from oauthService

/**
 * Get optimal posting times
 */
async function getOptimalPostingTimes(userId, platform) {
  try {
    // Analyze past posts to determine optimal times
    const posts = await ScheduledPost.find({
      userId,
      platform,
      status: 'posted'
    }).sort({ scheduledTime: -1 }).limit(100);

    if (posts.length === 0) {
      // Return default optimal times
      return getDefaultOptimalTimes(platform);
    }

    // Analyze engagement by hour/day
    const engagementByHour = {};
    posts.forEach(post => {
      const hour = new Date(post.scheduledTime).getHours();
      if (!engagementByHour[hour]) {
        engagementByHour[hour] = { total: 0, count: 0 };
      }
      engagementByHour[hour].total += post.engagement || 0;
      engagementByHour[hour].count += 1;
    });

    // Find top 3 hours
    const optimalHours = Object.entries(engagementByHour)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.total / data.count
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => ({
        hour: item.hour,
        time: `${item.hour}:00`,
        engagement: item.avgEngagement
      }));

    return optimalHours;
  } catch (error) {
    logger.error('Error getting optimal posting times', { error: error.message, userId, platform });
    return getDefaultOptimalTimes(platform);
  }
}

/**
 * Get default optimal posting times
 */
function getDefaultOptimalTimes(platform) {
  const defaults = {
    twitter: [
      { hour: 9, time: '09:00', engagement: 0 },
      { hour: 12, time: '12:00', engagement: 0 },
      { hour: 17, time: '17:00', engagement: 0 }
    ],
    linkedin: [
      { hour: 8, time: '08:00', engagement: 0 },
      { hour: 12, time: '12:00', engagement: 0 },
      { hour: 17, time: '17:00', engagement: 0 }
    ],
    facebook: [
      { hour: 9, time: '09:00', engagement: 0 },
      { hour: 13, time: '13:00', engagement: 0 },
      { hour: 19, time: '19:00', engagement: 0 }
    ],
    instagram: [
      { hour: 11, time: '11:00', engagement: 0 },
      { hour: 14, time: '14:00', engagement: 0 },
      { hour: 17, time: '17:00', engagement: 0 }
    ]
  };

  return defaults[platform] || defaults.twitter;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId, platform) {
  try {
    let connection;
    
    if (SocialConnection) {
      connection = await SocialConnection.findOne({
        userId,
        platform
      });
      
      if (!connection) {
        throw new Error('Connection not found');
      }
      
      if (!connection.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Platform-specific token refresh
      const newToken = await refreshPlatformToken(platform, connection.refreshToken);
      
      connection.accessToken = newToken.accessToken;
      if (newToken.refreshToken) {
        connection.refreshToken = newToken.refreshToken;
      }
      connection.lastRefreshed = new Date();
      
      await connection.save();
      return connection;
    } else {
      const user = await User.findById(userId);
      if (!user || !user.socialConnections || !user.socialConnections[platform]) {
        throw new Error('Connection not found');
      }

      connection = user.socialConnections[platform];
      if (!connection.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Platform-specific token refresh
      const newToken = await refreshPlatformToken(platform, connection.refreshToken);
      
      connection.accessToken = newToken.accessToken;
      if (newToken.refreshToken) {
        connection.refreshToken = newToken.refreshToken;
      }
      connection.lastRefreshed = new Date();

      await user.save();
      return connection;
    }
  } catch (error) {
    logger.error('Error refreshing access token', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Refresh platform token (uses real OAuth service)
 */
async function refreshPlatformToken(platform, refreshToken) {
  switch (platform.toLowerCase()) {
    case 'twitter':
      return await refreshTwitterToken(refreshToken);
    case 'linkedin':
      // LinkedIn token refresh (if supported)
      // For now, return error as LinkedIn tokens are long-lived
      throw new Error('LinkedIn tokens are long-lived and do not require refresh');
    case 'facebook':
    case 'instagram':
      // Facebook tokens are long-lived, but can be refreshed if needed
      // Implementation depends on Facebook API version
      throw new Error('Facebook token refresh not yet implemented');
    default:
      throw new Error(`Token refresh not supported for platform: ${platform}`);
  }
}

module.exports = {
  connectAccount,
  disconnectAccount,
  getConnectedAccounts,
  postToSocialMedia,
  getOptimalPostingTimes,
  refreshAccessToken
};
