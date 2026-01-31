// Usage Analytics Dashboard Routes
// Comprehensive usage analytics and insights

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getCurrentUsage,
  getUsageStats,
  canPerformAction
} = require('../services/usageTrackingService');
const User = require('../models/User');
const UsageTracking = require('../models/UsageTracking');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/usage-analytics/dashboard
 * Get comprehensive usage dashboard
 */
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  // Check both host header and x-forwarded-host (for proxy requests)
  const host = req.headers.host || req.headers['x-forwarded-host'] || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
  const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
  
  const mockData = {
    current: {
      usage: { videosProcessed: 0, contentGenerated: 0, postsScheduled: 0, storageUsed: 0 },
      limits: { videosProcessed: -1, contentGenerated: -1, postsScheduled: -1, storageUsed: -1 },
      overage: { videosProcessed: 0, contentGenerated: 0, postsScheduled: 0, storageUsed: 0 },
      percentages: { videosProcessed: 0, contentGenerated: 0, postsScheduled: 0, storageUsed: 0 }
    },
    stats: { periods: [] },
    trends: { videosProcessed: { trend: 'stable', change: 0 }, contentGenerated: { trend: 'stable', change: 0 }, postsScheduled: { trend: 'stable', change: 0 } },
    projections: { videosProcessed: { projected: 0, willExceed: false }, contentGenerated: { projected: 0, willExceed: false } },
    alerts: [],
    package: { name: 'Development Plan', slug: 'dev-plan' }
  };
  
  // In development mode OR when on localhost, return mock data for dev users
  if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
    return sendSuccess(res, 'Usage dashboard retrieved (dev mode)', 200, mockData);
  }
  
  let user, currentUsage, stats;
  try {
    user = await User.findById(userId).populate('membershipPackage');
    currentUsage = await getCurrentUsage(userId);
    stats = await getUsageStats(userId, 6); // Last 6 months
  } catch (dbError) {
    // Handle CastError gracefully for dev mode
    if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId'))) {
      logger.warn('CastError in usage analytics dashboard, returning mock data for dev mode', { error: dbError.message, userId });
      return sendSuccess(res, 'Usage dashboard retrieved (dev mode)', 200, mockData);
    }
    logger.warn('Database error in usage analytics dashboard', { error: dbError.message, userId });
    // Return empty data if database is unavailable
    return sendSuccess(res, 'Usage dashboard retrieved', 200, mockData);
  }

  // Calculate trends
  const trends = {
    videosProcessed: calculateTrend(stats.periods, 'videosProcessed'),
    contentGenerated: calculateTrend(stats.periods, 'contentGenerated'),
    postsScheduled: calculateTrend(stats.periods, 'postsScheduled')
  };

  // Calculate projections
  const projections = {
    videosProcessed: projectUsage(stats.periods, 'videosProcessed', currentUsage.limits.videosProcessed),
    contentGenerated: projectUsage(stats.periods, 'contentGenerated', currentUsage.limits.contentGenerated)
  };

  // Get usage alerts
  const alerts = generateUsageAlerts(currentUsage);

  sendSuccess(res, 'Usage dashboard retrieved', 200, {
    current: {
      usage: currentUsage.usage,
      limits: currentUsage.limits,
      overage: currentUsage.overage,
      percentages: calculatePercentages(currentUsage.usage, currentUsage.limits)
    },
    stats,
    trends,
    projections,
    alerts,
    package: {
      name: user.membershipPackage?.name,
      slug: user.membershipPackage?.slug
    }
  });
}));

/**
 * GET /api/usage-analytics/forecast
 * Forecast usage for next period
 */
router.get('/forecast', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  // In development mode, return mock data for dev users
  if (process.env.NODE_ENV === 'development' && userId && userId.toString().startsWith('dev-')) {
    return sendSuccess(res, 'Usage forecast retrieved (dev mode)', 200, {
      videosProcessed: { forecast: 0, confidence: 'low', willExceed: false, buffer: -1 },
      contentGenerated: { forecast: 0, confidence: 'low', willExceed: false, buffer: -1 },
      postsScheduled: { forecast: 0, confidence: 'low', willExceed: false, buffer: -1 },
      recommendations: []
    });
  }
  
  const stats = await getUsageStats(userId, 3);
  const currentUsage = await getCurrentUsage(userId);

  const forecast = {
    videosProcessed: forecastUsage(stats.periods, 'videosProcessed', currentUsage.limits.videosProcessed),
    contentGenerated: forecastUsage(stats.periods, 'contentGenerated', currentUsage.limits.contentGenerated),
    postsScheduled: forecastUsage(stats.periods, 'postsScheduled'),
    recommendations: generateRecommendations(stats, currentUsage)
  };

  sendSuccess(res, 'Usage forecast retrieved', 200, forecast);
}));

/**
 * GET /api/usage-analytics/breakdown
 * Get detailed usage breakdown
 */
router.get('/breakdown', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  // In development mode, return mock data for dev users
  if (process.env.NODE_ENV === 'development' && userId && userId.toString().startsWith('dev-')) {
    return sendSuccess(res, 'Usage breakdown retrieved (dev mode)', 200, {
      period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
      usage: { videosProcessed: 0, contentGenerated: 0, storageUsed: 0 },
      limits: { videosProcessed: -1, contentGenerated: -1, storageUsed: -1 },
      overage: { videosProcessed: 0, contentGenerated: 0, storageUsed: 0 },
      percentages: { videosProcessed: 0, contentGenerated: 0, storageUsed: 0 },
      details: {
        videosProcessed: { used: 0, limit: -1, remaining: -1, overage: 0 },
        contentGenerated: { used: 0, limit: -1, remaining: -1, overage: 0 },
        storageUsed: { used: '0 B', limit: 'Unlimited', remaining: 'Unlimited', overage: '0 B' }
      }
    });
  }
  
  const { period } = req.query; // 'current', 'last', or 'YYYY-MM'
  const user = await User.findById(userId);

  let usage;
  if (period === 'current') {
    usage = await getCurrentUsage(userId);
  } else if (period === 'last') {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    usage = await UsageTracking.findOne({
      userId: userId,
      'period.year': lastMonth.getFullYear(),
      'period.month': lastMonth.getMonth() + 1
    });
  } else if (period) {
    const [year, month] = period.split('-').map(Number);
    usage = await UsageTracking.findOne({
      userId: userId,
      'period.year': year,
      'period.month': month
    });
  } else {
    usage = await getCurrentUsage(userId);
  }

  if (!usage) {
    return sendError(res, 'Usage data not found', 404);
  }

  const breakdown = {
    period: usage.period,
    usage: usage.usage,
    limits: usage.limits,
    overage: usage.overage,
    percentages: calculatePercentages(usage.usage, usage.limits),
    details: {
      videosProcessed: {
        used: usage.usage.videosProcessed,
        limit: usage.limits.videosProcessed,
        remaining: usage.limits.videosProcessed === -1 ? -1 : Math.max(0, usage.limits.videosProcessed - usage.usage.videosProcessed),
        overage: usage.overage.videosProcessed || 0
      },
      contentGenerated: {
        used: usage.usage.contentGenerated,
        limit: usage.limits.contentGenerated,
        remaining: usage.limits.contentGenerated === -1 ? -1 : Math.max(0, usage.limits.contentGenerated - usage.usage.contentGenerated),
        overage: usage.overage.contentGenerated || 0
      },
      storageUsed: {
        used: formatBytes(usage.usage.storageUsed),
        limit: formatBytes(usage.limits.storageUsed),
        remaining: usage.limits.storageUsed === -1 ? 'Unlimited' : formatBytes(Math.max(0, usage.limits.storageUsed - usage.usage.storageUsed)),
        overage: formatBytes(usage.overage.storageUsed || 0)
      }
    }
  };

  sendSuccess(res, 'Usage breakdown retrieved', 200, breakdown);
}));

// Helper functions
function calculateTrend(periods, metric) {
  if (periods.length < 2) return { trend: 'stable', change: 0 };

  const recent = periods[0]?.usage[metric] || 0;
  const previous = periods[1]?.usage[metric] || 0;

  if (previous === 0) return { trend: 'increasing', change: 100 };

  const change = ((recent - previous) / previous) * 100;
  const trend = change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';

  return { trend, change: Math.round(change * 10) / 10 };
}

function projectUsage(periods, metric, limit) {
  if (periods.length === 0) return { projected: 0, willExceed: false };

  const avg = periods.reduce((sum, p) => sum + (p.usage[metric] || 0), 0) / periods.length;
  const projected = Math.round(avg);

  return {
    projected,
    willExceed: limit !== -1 && projected > limit,
    buffer: limit === -1 ? -1 : limit - projected
  };
}

function forecastUsage(periods, metric, limit = -1) {
  if (periods.length === 0) return { forecast: 0, confidence: 'low' };

  // Simple linear regression
  const values = periods.map(p => p.usage[metric] || 0).reverse();
  const n = values.length;
  const sumX = (n * (n + 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + (idx + 1) * val, 0);
  const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = Math.max(0, Math.round(slope * (n + 1) + intercept));
  const confidence = n >= 3 ? 'high' : n >= 2 ? 'medium' : 'low';

  return {
    forecast,
    confidence,
    willExceed: limit !== -1 && forecast > limit,
    buffer: limit === -1 ? -1 : limit - forecast
  };
}

function calculatePercentages(usage, limits) {
  const percentages = {};
  Object.keys(usage).forEach(key => {
    const limit = limits[key];
    if (limit !== -1 && limit > 0) {
      percentages[key] = Math.min(100, Math.round((usage[key] / limit) * 100));
    } else {
      percentages[key] = -1; // Unlimited
    }
  });
  return percentages;
}

function generateUsageAlerts(usage) {
  const alerts = [];
  const percentages = calculatePercentages(usage.usage, usage.limits);

  Object.keys(percentages).forEach(key => {
    const percent = percentages[key];
    if (percent >= 90) {
      alerts.push({
        type: 'critical',
        metric: key,
        message: `${key} usage is at ${percent}% of limit`,
        action: 'upgrade'
      });
    } else if (percent >= 75) {
      alerts.push({
        type: 'warning',
        metric: key,
        message: `${key} usage is at ${percent}% of limit`,
        action: 'monitor'
      });
    }
  });

  // Check for overage
  Object.keys(usage.overage).forEach(key => {
    if (usage.overage[key] > 0) {
      alerts.push({
        type: 'error',
        metric: key,
        message: `${key} limit exceeded by ${usage.overage[key]}`,
        action: 'upgrade'
      });
    }
  });

  return alerts;
}

function generateRecommendations(stats, currentUsage) {
  const recommendations = [];

  // Check if user is consistently hitting limits
  const avgVideos = stats.periods.reduce((sum, p) => sum + (p.usage.videosProcessed || 0), 0) / stats.periods.length;
  if (currentUsage.limits.videosProcessed !== -1 && avgVideos >= currentUsage.limits.videosProcessed * 0.8) {
    recommendations.push({
      type: 'upgrade',
      metric: 'videosProcessed',
      message: 'Consider upgrading or adding extra videos add-on',
      action: 'upgrade'
    });
  }

  const avgContent = stats.periods.reduce((sum, p) => sum + (p.usage.contentGenerated || 0), 0) / stats.periods.length;
  if (currentUsage.limits.contentGenerated !== -1 && avgContent >= currentUsage.limits.contentGenerated * 0.8) {
    recommendations.push({
      type: 'upgrade',
      metric: 'contentGenerated',
      message: 'Consider upgrading or adding extra content generations add-on',
      action: 'upgrade'
    });
  }

  return recommendations;
}

function formatBytes(bytes) {
  if (bytes === -1) return 'Unlimited';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;


