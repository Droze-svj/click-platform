// Audience Growth Sync Service
// Sync follower counts from social platforms

const SocialConnection = require('../models/SocialConnection');
const { recordAudienceGrowth } = require('./socialPerformanceMetricsService');
const { getValidAccessToken } = require('./tokenRefreshService');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Sync audience growth for a platform
 */
async function syncAudienceGrowth(userId, platform) {
  try {
    const connection = await SocialConnection.findOne({
      userId,
      platform,
      isActive: true
    }).lean();

    if (!connection) {
      throw new Error(`No active connection found for ${platform}`);
    }

    const accessToken = await getValidAccessToken(userId, platform);
    let followerData = null;

    // Platform-specific API calls
    switch (platform.toLowerCase()) {
      case 'twitter':
        followerData = await syncTwitterFollowers(userId, accessToken, connection);
        break;
      case 'linkedin':
        followerData = await syncLinkedInFollowers(userId, accessToken, connection);
        break;
      case 'instagram':
      case 'facebook':
        followerData = await syncFacebookFollowers(userId, accessToken, connection, platform);
        break;
      case 'youtube':
        followerData = await syncYouTubeFollowers(userId, accessToken, connection);
        break;
      case 'tiktok':
        followerData = await syncTikTokFollowers(userId, accessToken, connection);
        break;
      default:
        throw new Error(`Follower sync not supported for ${platform}`);
    }

    if (followerData) {
      // Record growth snapshot
      const growth = await recordAudienceGrowth(userId, platform, {
        platformAccountId: connection.platformUserId || connection.platformAccountId,
        followers: followerData.followers,
        following: followerData.following || 0,
        newFollowers: followerData.newFollowers || 0,
        lostFollowers: followerData.lostFollowers || 0,
        period: 'daily',
        metadata: {
          platformUsername: connection.username,
          accountType: connection.accountType,
          verified: connection.verified
        }
      });

      return growth;
    }

    return null;
  } catch (error) {
    logger.error('Error syncing audience growth', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Sync Twitter followers
 */
async function syncTwitterFollowers(userId, accessToken, connection) {
  try {
    const response = await axios.get('https://api.twitter.com/2/users/me', {
      params: {
        'user.fields': 'public_metrics,username,verified'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = response.data.data;
    const metrics = user.public_metrics || {};

    return {
      followers: metrics.followers_count || 0,
      following: metrics.following_count || 0
    };
  } catch (error) {
    logger.error('Error syncing Twitter followers', { error: error.message });
    throw error;
  }
}

/**
 * Sync LinkedIn followers
 */
async function syncLinkedInFollowers(userId, accessToken, connection) {
  try {
    const response = await axios.get('https://api.linkedin.com/v2/networkSizes/urn:li:person:' + connection.platformUserId, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      followers: response.data.firstDegreeSize || 0,
      following: 0 // LinkedIn doesn't provide following count in basic API
    };
  } catch (error) {
    logger.error('Error syncing LinkedIn followers', { error: error.message });
    throw error;
  }
}

/**
 * Sync Facebook/Instagram followers
 */
async function syncFacebookFollowers(userId, accessToken, connection, platform) {
  try {
    const endpoint = platform === 'instagram' 
      ? `https://graph.facebook.com/v18.0/${connection.platformUserId}`
      : `https://graph.facebook.com/v18.0/${connection.platformUserId}`;

    const response = await axios.get(endpoint, {
      params: {
        fields: 'followers_count,follows_count',
        access_token: accessToken
      }
    });

    return {
      followers: response.data.followers_count || 0,
      following: response.data.follows_count || 0
    };
  } catch (error) {
    logger.error('Error syncing Facebook/Instagram followers', { error: error.message });
    throw error;
  }
}

/**
 * Sync YouTube subscribers
 */
async function syncYouTubeFollowers(userId, accessToken, connection) {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'statistics',
        mine: true,
        access_token: accessToken
      }
    });

    const channel = response.data.items?.[0];
    const stats = channel?.statistics || {};

    return {
      followers: parseInt(stats.subscriberCount) || 0,
      following: 0
    };
  } catch (error) {
    logger.error('Error syncing YouTube subscribers', { error: error.message });
    throw error;
  }
}

/**
 * Sync TikTok followers
 */
async function syncTikTokFollowers(userId, accessToken, connection) {
  try {
    // TikTok API endpoint (would need TikTok API access)
    // This is a placeholder - TikTok API requires special approval
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'follower_count,following_count'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      followers: response.data.data?.follower_count || 0,
      following: response.data.data?.following_count || 0
    };
  } catch (error) {
    logger.error('Error syncing TikTok followers', { error: error.message });
    throw error;
  }
}

/**
 * Sync all platforms for user
 */
async function syncAllPlatformsAudienceGrowth(userId) {
  try {
    const connections = await SocialConnection.find({
      userId,
      isActive: true
    }).lean();

    const results = {
      total: connections.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const connection of connections) {
      try {
        await syncAudienceGrowth(userId, connection.platform);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          platform: connection.platform,
          error: error.message
        });
      }
    }

    logger.info('Synced audience growth for all platforms', { userId, ...results });
    return results;
  } catch (error) {
    logger.error('Error syncing all platforms audience growth', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  syncAudienceGrowth,
  syncAllPlatformsAudienceGrowth
};


