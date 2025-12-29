// Music Usage Quota Service
// Manages usage quotas and limits

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');
const MusicLicense = require('../models/MusicLicense');

/**
 * Check usage quota for user/workspace
 */
async function checkUsageQuota(userId, workspaceId, quotaType = 'monthly') {
  try {
    // Get quota limits from subscription/user settings
    // For now, return default quotas
    const quotas = await getUserQuotas(userId, workspaceId);

    // Get current usage
    const usage = await getCurrentUsage(userId, workspaceId, quotaType);

    return {
      quota: quotas[quotaType] || null,
      usage,
      remaining: quotas[quotaType] ? quotas[quotaType] - usage : null,
      exceeded: quotas[quotaType] ? usage >= quotas[quotaType] : false,
      percentage: quotas[quotaType] ? (usage / quotas[quotaType]) * 100 : 0
    };
  } catch (error) {
    logger.error('Error checking usage quota', {
      error: error.message,
      userId,
      workspaceId
    });
    throw error;
  }
}

/**
 * Get user quotas
 */
async function getUserQuotas(userId, workspaceId) {
  // In production, this would fetch from subscription/user settings
  // Default quotas for now
  return {
    monthly: 100, // 100 tracks per month
    daily: 10, // 10 tracks per day
    perLicense: 50 // 50 uses per licensed track
  };
}

/**
 * Get current usage
 */
async function getCurrentUsage(userId, workspaceId, quotaType) {
  try {
    const now = new Date();
    let startDate;

    switch (quotaType) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(0); // All time
    }

    const query = {
      userId,
      renderTimestamp: { $gte: startDate }
    };

    if (workspaceId) {
      query.workspaceId = workspaceId;
    }

    const count = await MusicLicenseUsage.countDocuments(query);

    return count;
  } catch (error) {
    logger.error('Error getting current usage', {
      error: error.message,
      userId,
      workspaceId
    });
    return 0;
  }
}

/**
 * Check if user can use track (quota check)
 */
async function canUseTrack(userId, workspaceId, trackId, source) {
  try {
    // Check general quota
    const quotaCheck = await checkUsageQuota(userId, workspaceId, 'monthly');

    if (quotaCheck.exceeded) {
      return {
        allowed: false,
        reason: 'Monthly usage quota exceeded',
        quota: quotaCheck.quota,
        usage: quotaCheck.usage
      };
    }

    // Check daily quota
    const dailyQuota = await checkUsageQuota(userId, workspaceId, 'daily');

    if (dailyQuota.exceeded) {
      return {
        allowed: false,
        reason: 'Daily usage quota exceeded',
        quota: dailyQuota.quota,
        usage: dailyQuota.usage
      };
    }

    // Check per-license quota if licensed track
    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).lean();
      if (license && license.usageLimit) {
        const usageCount = license.usageCount || 0;
        if (usageCount >= license.usageLimit) {
          return {
            allowed: false,
            reason: 'License usage limit reached',
            usageCount,
            usageLimit: license.usageLimit
          };
        }
      }
    }

    return {
      allowed: true,
      quota: quotaCheck.quota,
      usage: quotaCheck.usage,
      remaining: quotaCheck.remaining
    };
  } catch (error) {
    logger.error('Error checking if user can use track', {
      error: error.message,
      userId,
      trackId
    });
    return {
      allowed: false,
      reason: error.message
    };
  }
}

/**
 * Get quota statistics
 */
async function getQuotaStatistics(userId, workspaceId) {
  try {
    const monthly = await checkUsageQuota(userId, workspaceId, 'monthly');
    const daily = await checkUsageQuota(userId, workspaceId, 'daily');

    return {
      monthly,
      daily,
      recommendations: generateQuotaRecommendations(monthly, daily)
    };
  } catch (error) {
    logger.error('Error getting quota statistics', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Generate quota recommendations
 */
function generateQuotaRecommendations(monthly, daily) {
  const recommendations = [];

  if (monthly.percentage > 90) {
    recommendations.push({
      type: 'warning',
      message: 'Monthly quota almost exhausted. Consider upgrading your plan.',
      action: 'upgrade'
    });
  }

  if (daily.percentage > 80) {
    recommendations.push({
      type: 'info',
      message: 'High daily usage. Daily quota resets at midnight.',
      action: 'monitor'
    });
  }

  return recommendations;
}

module.exports = {
  checkUsageQuota,
  canUseTrack,
  getQuotaStatistics
};







