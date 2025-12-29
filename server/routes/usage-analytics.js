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
  const user = await User.findById(req.user._id).populate('membershipPackage');
  const currentUsage = await getCurrentUsage(req.user._id);
  const stats = await getUsageStats(req.user._id, 6); // Last 6 months

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
  const stats = await getUsageStats(req.user._id, 3);
  const currentUsage = await getCurrentUsage(req.user._id);

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
  const { period } = req.query; // 'current', 'last', or 'YYYY-MM'
  const user = await User.findById(req.user._id);

  let usage;
  if (period === 'current') {
    usage = await getCurrentUsage(req.user._id);
  } else if (period === 'last') {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    usage = await UsageTracking.findOne({
      userId: user._id,
      'period.year': lastMonth.getFullYear(),
      'period.month': lastMonth.getMonth() + 1
    });
  } else if (period) {
    const [year, month] = period.split('-').map(Number);
    usage = await UsageTracking.findOne({
      userId: user._id,
      'period.year': year,
      'period.month': month
    });
  } else {
    usage = await getCurrentUsage(req.user._id);
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


