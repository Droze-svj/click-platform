// Usage Tracking Service
// Track and display usage clearly

const User = require('../models/User');
const UsageBasedTier = require('../models/UsageBasedTier');
const logger = require('../utils/logger');

/**
 * Get user usage summary
 */
async function getUserUsageSummary(userId) {
  try {
    const user = await User.findById(userId).populate('membershipPackage').lean();
    if (!user) {
      throw new Error('User not found');
    }

    // Get tier
    const tier = await UsageBasedTier.findById(user.membershipPackage).lean();
    if (!tier) {
      throw new Error('Tier not found');
    }

    // Get actual usage (would query from usage records)
    const usage = await getActualUsage(userId);

    // Calculate usage percentages
    const usageSummary = {
      tier: {
        id: tier._id,
        name: tier.name,
        slug: tier.slug
      },
      usage: {
        aiMinutes: {
          used: usage.aiMinutes || 0,
          limit: tier.usage.aiMinutes.monthly,
          percentage: tier.usage.aiMinutes.monthly > 0
            ? Math.round((usage.aiMinutes / tier.usage.aiMinutes.monthly) * 100)
            : 0,
          overage: Math.max(0, (usage.aiMinutes || 0) - tier.usage.aiMinutes.monthly),
          overageCost: 0 // Would calculate
        },
        clients: {
          used: usage.clients || 0,
          limit: tier.usage.clients.max,
          percentage: tier.usage.clients.max > 0
            ? Math.round((usage.clients / tier.usage.clients.max) * 100)
            : 0,
          overage: Math.max(0, (usage.clients || 0) - tier.usage.clients.max),
          overageCost: 0
        },
        profiles: {
          used: usage.profiles || 0,
          limit: tier.usage.profiles.max,
          percentage: tier.usage.profiles.max > 0
            ? Math.round((usage.profiles / tier.usage.profiles.max) * 100)
            : 0,
          overage: Math.max(0, (usage.profiles || 0) - tier.usage.profiles.max),
          overageCost: 0
        },
        content: {
          posts: {
            used: usage.posts || 0,
            limit: tier.usage.content.postsPerMonth === -1 ? null : tier.usage.content.postsPerMonth,
            percentage: tier.usage.content.postsPerMonth === -1 ? null :
              Math.round((usage.posts / tier.usage.content.postsPerMonth) * 100)
          },
          videos: {
            used: usage.videos || 0,
            limit: tier.usage.content.videosPerMonth === -1 ? null : tier.usage.content.videosPerMonth,
            percentage: tier.usage.content.videosPerMonth === -1 ? null :
              Math.round((usage.videos / tier.usage.content.videosPerMonth) * 100)
          }
        }
      },
      features: tier.features,
      billing: {
        currentPeriod: {
          start: user.subscription?.startDate || new Date(),
          end: user.subscription?.endDate || new Date()
        },
        nextBillingDate: user.subscription?.endDate || null
      }
    };

    return usageSummary;
  } catch (error) {
    logger.error('Error getting usage summary', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get actual usage
 */
async function getActualUsage(userId) {
  // Would query actual usage from database
  // For now, return placeholder
  return {
    aiMinutes: 0,
    clients: 0,
    profiles: 0,
    posts: 0,
    videos: 0
  };
}

/**
 * Check usage limits
 */
async function checkUsageLimits(userId, action) {
  try {
    const summary = await getUserUsageSummary(userId);

    const limits = {
      aiMinutes: summary.usage.aiMinutes.used >= summary.usage.aiMinutes.limit,
      clients: summary.usage.clients.used >= summary.usage.clients.limit,
      profiles: summary.usage.profiles.used >= summary.usage.profiles.limit,
      posts: summary.usage.content.posts.limit && summary.usage.content.posts.used >= summary.usage.content.posts.limit,
      videos: summary.usage.content.videos.limit && summary.usage.content.videos.used >= summary.usage.content.videos.limit
    };

    // Check specific action
    if (action === 'ai_generation' && limits.aiMinutes) {
      return {
        allowed: false,
        reason: 'AI minutes limit reached',
        upgradeRequired: true
      };
    }

    if (action === 'add_client' && limits.clients) {
      return {
        allowed: false,
        reason: 'Client limit reached',
        upgradeRequired: true
      };
    }

    if (action === 'connect_profile' && limits.profiles) {
      return {
        allowed: false,
        reason: 'Profile limit reached',
        upgradeRequired: true
      };
    }

    return {
      allowed: true,
      limits,
      summary
    };
  } catch (error) {
    logger.error('Error checking usage limits', { error: error.message, userId });
    return { allowed: false, reason: 'Error checking limits' };
  }
}

module.exports = {
  getUserUsageSummary,
  checkUsageLimits
};
