// Feature Flags Service

const { get, set, del } = require('./cacheService');
const logger = require('../utils/logger');

// Feature flag definitions
const featureFlags = {
  // New features
  'advanced-video-editing': {
    enabled: process.env.FEATURE_ADVANCED_VIDEO === 'true',
    rollout: 0, // 0-100 percentage
    users: [], // Specific user IDs
    description: 'Advanced video editing features',
  },
  'ai-recommendations': {
    enabled: process.env.FEATURE_AI_RECOMMENDATIONS === 'true',
    rollout: 0,
    users: [],
    description: 'AI-powered content recommendations',
  },
  'collaboration-v2': {
    enabled: process.env.FEATURE_COLLAB_V2 === 'true',
    rollout: 0,
    users: [],
    description: 'Enhanced collaboration features',
  },
  'analytics-dashboard': {
    enabled: true,
    rollout: 100,
    users: [],
    description: 'Analytics dashboard',
  },
  'chunked-uploads': {
    enabled: true,
    rollout: 100,
    users: [],
    description: 'Chunked file uploads',
  },
};

/**
 * Check if feature is enabled for user
 */
async function isFeatureEnabled(featureName, userId = null) {
  try {
    // Get feature flag config
    const flag = featureFlags[featureName];
    if (!flag) {
      logger.warn('Unknown feature flag', { featureName });
      return false;
    }

    // Check cache first
    const cacheKey = `feature:${featureName}:${userId || 'global'}`;
    const cached = await get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Check if globally enabled
    if (!flag.enabled) {
      await set(cacheKey, false, 300); // Cache for 5 minutes
      return false;
    }

    // Check if user is in specific users list
    if (userId && flag.users && flag.users.includes(userId.toString())) {
      await set(cacheKey, true, 300);
      return true;
    }

    // Check rollout percentage
    if (flag.rollout === 100) {
      await set(cacheKey, true, 300);
      return true;
    }

    if (flag.rollout === 0) {
      await set(cacheKey, false, 300);
      return false;
    }

    // Percentage-based rollout
    if (userId) {
      const hash = simpleHash(userId.toString() + featureName);
      const enabled = (hash % 100) < flag.rollout;
      await set(cacheKey, enabled, 300);
      return enabled;
    }

    return false;
  } catch (error) {
    logger.error('Feature flag check error', { featureName, error: error.message });
    return false; // Fail closed
  }
}

/**
 * Enable feature for specific user
 */
async function enableFeatureForUser(featureName, userId) {
  try {
    if (!featureFlags[featureName]) {
      throw new Error('Unknown feature flag');
    }

    if (!featureFlags[featureName].users) {
      featureFlags[featureName].users = [];
    }

    if (!featureFlags[featureName].users.includes(userId.toString())) {
      featureFlags[featureName].users.push(userId.toString());
    }

    // Invalidate cache
    await del(`feature:${featureName}:${userId}`);
    await del(`feature:${featureName}:global`);

    logger.info('Feature enabled for user', { featureName, userId });
    return true;
  } catch (error) {
    logger.error('Enable feature error', { featureName, userId, error: error.message });
    throw error;
  }
}

/**
 * Disable feature for specific user
 */
async function disableFeatureForUser(featureName, userId) {
  try {
    if (!featureFlags[featureName]) {
      throw new Error('Unknown feature flag');
    }

    if (featureFlags[featureName].users) {
      featureFlags[featureName].users = featureFlags[featureName].users.filter(
        id => id !== userId.toString()
      );
    }

    // Invalidate cache
    await del(`feature:${featureName}:${userId}`);
    await del(`feature:${featureName}:global`);

    logger.info('Feature disabled for user', { featureName, userId });
    return true;
  } catch (error) {
    logger.error('Disable feature error', { featureName, userId, error: error.message });
    throw error;
  }
}

/**
 * Set rollout percentage
 */
async function setRollout(featureName, percentage) {
  try {
    if (!featureFlags[featureName]) {
      throw new Error('Unknown feature flag');
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    featureFlags[featureName].rollout = percentage;

    // Invalidate all caches for this feature
    // In production, use pattern deletion
    logger.info('Rollout percentage set', { featureName, percentage });
    return true;
  } catch (error) {
    logger.error('Set rollout error', { featureName, percentage, error: error.message });
    throw error;
  }
}

/**
 * Get all feature flags
 */
function getAllFeatureFlags() {
  return Object.keys(featureFlags).map(name => ({
    name,
    ...featureFlags[name],
  }));
}

/**
 * Get feature flag status
 */
function getFeatureFlag(featureName) {
  return featureFlags[featureName] || null;
}

/**
 * Simple hash function for consistent user assignment
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Middleware to add feature flags to request
 */
function featureFlagsMiddleware(req, res, next) {
  req.featureFlags = {
    isEnabled: async (featureName) => {
      return await isFeatureEnabled(featureName, req.user?._id?.toString());
    },
  };
  next();
}

module.exports = {
  isFeatureEnabled,
  enableFeatureForUser,
  disableFeatureForUser,
  setRollout,
  getAllFeatureFlags,
  getFeatureFlag,
  featureFlagsMiddleware,
};






