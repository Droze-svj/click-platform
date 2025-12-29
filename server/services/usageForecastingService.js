// Usage Forecasting Service
// Predict future usage and suggest upgrades

const User = require('../models/User');
const UsageBasedTier = require('../models/UsageBasedTier');
const logger = require('../utils/logger');

/**
 * Forecast usage for next period
 */
async function forecastUsage(userId, period = 'month') {
  try {
    // Get historical usage (would query from usage records)
    const historicalUsage = await getHistoricalUsage(userId, period);
    
    if (!historicalUsage || historicalUsage.length < 2) {
      return {
        forecast: null,
        confidence: 'low',
        message: 'Insufficient data for forecasting'
      };
    }

    // Calculate trends
    const trends = calculateTrends(historicalUsage);

    // Forecast next period
    const forecast = {
      aiMinutes: forecastValue(historicalUsage, 'aiMinutes', trends.aiMinutes),
      clients: forecastValue(historicalUsage, 'clients', trends.clients),
      profiles: forecastValue(historicalUsage, 'profiles', trends.profiles),
      posts: forecastValue(historicalUsage, 'posts', trends.posts),
      videos: forecastValue(historicalUsage, 'videos', trends.videos)
    };

    // Calculate confidence
    const confidence = calculateConfidence(historicalUsage, trends);

    // Check if forecast exceeds current limits
    const user = await User.findById(userId).populate('membershipPackage').lean();
    const tier = await UsageBasedTier.findById(user.membershipPackage).lean();
    
    const willExceed = {
      aiMinutes: tier && forecast.aiMinutes > tier.usage.aiMinutes.monthly,
      clients: tier && forecast.clients > tier.usage.clients.max,
      profiles: tier && forecast.profiles > tier.usage.profiles.max
    };

    return {
      forecast,
      trends,
      confidence,
      willExceed,
      recommendations: await generateUpgradeRecommendations(userId, forecast, willExceed, tier)
    };
  } catch (error) {
    logger.error('Error forecasting usage', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get historical usage
 */
async function getHistoricalUsage(userId, period) {
  // Would query actual usage history
  // For now, return placeholder
  return [
    { period: '2024-01', aiMinutes: 100, clients: 2, profiles: 5, posts: 50, videos: 10 },
    { period: '2024-02', aiMinutes: 150, clients: 3, profiles: 6, posts: 60, videos: 12 },
    { period: '2024-03', aiMinutes: 200, clients: 3, profiles: 7, posts: 70, videos: 15 }
  ];
}

/**
 * Calculate trends
 */
function calculateTrends(historicalUsage) {
  const trends = {};
  const metrics = ['aiMinutes', 'clients', 'profiles', 'posts', 'videos'];

  metrics.forEach(metric => {
    const values = historicalUsage.map(u => u[metric] || 0);
    if (values.length < 2) {
      trends[metric] = 'stable';
      return;
    }

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    if (change > 10) {
      trends[metric] = 'increasing';
    } else if (change < -10) {
      trends[metric] = 'decreasing';
    } else {
      trends[metric] = 'stable';
    }
  });

  return trends;
}

/**
 * Forecast value
 */
function forecastValue(historicalUsage, metric, trend) {
  const values = historicalUsage.map(u => u[metric] || 0);
  const lastValue = values[values.length - 1];
  const avgGrowth = calculateAverageGrowth(values);

  if (trend === 'increasing') {
    return Math.round(lastValue * (1 + avgGrowth));
  } else if (trend === 'decreasing') {
    return Math.round(lastValue * (1 - Math.abs(avgGrowth)));
  } else {
    return lastValue;
  }
}

/**
 * Calculate average growth
 */
function calculateAverageGrowth(values) {
  if (values.length < 2) return 0;

  const growthRates = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      growthRates.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  return growthRates.length > 0
    ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
    : 0;
}

/**
 * Calculate confidence
 */
function calculateConfidence(historicalUsage, trends) {
  const dataPoints = historicalUsage.length;
  const consistentTrends = Object.values(trends).filter(t => t !== 'stable').length;

  if (dataPoints >= 6 && consistentTrends > 0) {
    return 'high';
  } else if (dataPoints >= 3) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Generate upgrade recommendations
 */
async function generateUpgradeRecommendations(userId, forecast, willExceed, currentTier) {
  if (!currentTier || !willExceed) {
    return [];
  }

  const recommendations = [];

  // Find better tiers
  const betterTiers = await UsageBasedTier.find({
    isActive: true,
    _id: { $ne: currentTier._id }
  }).sort({ 'pricing.monthly.amount': 1 }).lean();

  for (const tier of betterTiers) {
    const reasons = [];

    if (willExceed.aiMinutes && tier.usage.aiMinutes.monthly >= forecast.aiMinutes) {
      reasons.push(`Supports forecasted ${forecast.aiMinutes} AI minutes`);
    }

    if (willExceed.clients && tier.usage.clients.max >= forecast.clients) {
      reasons.push(`Supports forecasted ${forecast.clients} clients`);
    }

    if (willExceed.profiles && tier.usage.profiles.max >= forecast.profiles) {
      reasons.push(`Supports forecasted ${forecast.profiles} profiles`);
    }

    if (reasons.length > 0) {
      recommendations.push({
        tier: {
          id: tier._id,
          name: tier.name,
          slug: tier.slug,
          monthlyPrice: tier.pricing.monthly.amount,
          yearlyPrice: tier.pricing.yearly.amount
        },
        reasons,
        savings: calculateSavings(currentTier, tier),
        urgency: calculateUrgency(forecast, willExceed, tier)
      });
    }
  }

  return recommendations.sort((a, b) => {
    // Sort by urgency first, then by price
    if (a.urgency !== b.urgency) {
      return b.urgency - a.urgency;
    }
    return a.tier.monthlyPrice - b.tier.monthlyPrice;
  });
}

/**
 * Calculate savings
 */
function calculateSavings(currentTier, newTier) {
  const currentOverage = calculateOverageCost(currentTier);
  const newOverage = calculateOverageCost(newTier);
  const tierUpgrade = newTier.pricing.monthly.amount - currentTier.pricing.monthly.amount;

  return {
    overageSavings: currentOverage - newOverage,
    netCost: tierUpgrade - (currentOverage - newOverage),
    breakEven: currentOverage > tierUpgrade
  };
}

/**
 * Calculate overage cost
 */
function calculateOverageCost(tier) {
  // Would calculate based on forecasted overage
  return 0;
}

/**
 * Calculate urgency
 */
function calculateUrgency(forecast, willExceed, tier) {
  let urgency = 0;

  if (willExceed.aiMinutes) {
    const overage = forecast.aiMinutes - tier.usage.aiMinutes.monthly;
    urgency += Math.min(overage / tier.usage.aiMinutes.monthly, 1) * 3;
  }

  if (willExceed.clients) {
    urgency += 2;
  }

  if (willExceed.profiles) {
    urgency += 1;
  }

  return Math.min(urgency, 5); // Max urgency of 5
}

/**
 * Get usage alerts
 */
async function getUsageAlerts(userId) {
  try {
    const forecast = await forecastUsage(userId);
    const user = await User.findById(userId).populate('membershipPackage').lean();
    const tier = await UsageBasedTier.findById(user.membershipPackage).lean();
    const currentUsage = await getUserUsageSummary(userId);

    const alerts = [];

    // Check current usage thresholds
    if (currentUsage.usage.aiMinutes.percentage >= 90) {
      alerts.push({
        type: 'warning',
        metric: 'aiMinutes',
        message: `You've used ${currentUsage.usage.aiMinutes.percentage}% of your AI minutes`,
        action: 'upgrade_or_reduce_usage'
      });
    }

    if (currentUsage.usage.clients.percentage >= 90) {
      alerts.push({
        type: 'warning',
        metric: 'clients',
        message: `You've used ${currentUsage.usage.clients.percentage}% of your client limit`,
        action: 'upgrade_or_reduce_clients'
      });
    }

    // Check forecast
    if (forecast.willExceed && Object.values(forecast.willExceed).some(e => e)) {
      alerts.push({
        type: 'forecast',
        message: 'Forecast shows you may exceed limits next period',
        forecast: forecast.forecast,
        recommendations: forecast.recommendations
      });
    }

    return alerts;
  } catch (error) {
    logger.error('Error getting usage alerts', { error: error.message, userId });
    return [];
  }
}

// Import getUserUsageSummary
const { getUserUsageSummary } = require('./usageTrackingService');

module.exports = {
  forecastUsage,
  getUsageAlerts
};


