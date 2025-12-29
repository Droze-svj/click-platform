// Revenue Forecasting Service
// Predict future revenue based on historical data

const RevenueAttribution = require('../models/RevenueAttribution');
const Conversion = require('../models/Conversion');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Forecast revenue for a period
 */
async function forecastRevenue(workspaceId, period, filters = {}) {
  try {
    const {
      days = 30,
      platform = null,
      campaignId = null
    } = filters;

    // Get historical data (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const query = { workspaceId };
    if (platform) query.platform = platform;
    if (campaignId) query.campaignId = campaignId;

    // Get historical revenue
    const historicalRevenue = await RevenueAttribution.find({
      ...query,
      'period.startDate': { $gte: startDate, $lte: endDate }
    })
      .sort({ 'period.startDate': 1 })
      .lean();

    // Get historical conversions
    const historicalConversions = await Conversion.find({
      workspaceId,
      'conversionData.timestamp': { $gte: startDate, $lte: endDate },
      ...(platform ? { platform } : {}),
      ...(campaignId ? { 'attribution.campaign': campaignId.toString() } : {})
    })
      .sort({ 'conversionData.timestamp': 1 })
      .lean();

    // Get historical posts
    const historicalPosts = await ScheduledPost.find({
      workspaceId,
      status: 'posted',
      postedAt: { $gte: startDate, $lte: endDate },
      ...(platform ? { platform } : {}),
      ...(campaignId ? { campaignId } : {})
    })
      .sort({ postedAt: 1 })
      .lean();

    // Calculate trends
    const trends = calculateTrends(historicalRevenue, historicalConversions, historicalPosts);

    // Generate forecast
    const forecast = generateForecast(trends, days);

    return {
      forecast,
      trends,
      confidence: calculateConfidence(historicalRevenue.length, historicalConversions.length),
      assumptions: [
        'Based on historical performance trends',
        'Assumes consistent posting frequency',
        'Does not account for seasonality or external factors'
      ]
    };
  } catch (error) {
    logger.error('Error forecasting revenue', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Calculate trends from historical data
 */
function calculateTrends(revenue, conversions, posts) {
  const trends = {
    revenue: {
      daily: [],
      weekly: [],
      monthly: []
    },
    conversions: {
      daily: [],
      weekly: [],
      monthly: []
    },
    posts: {
      daily: [],
      weekly: [],
      monthly: []
    },
    averages: {
      revenuePerPost: 0,
      revenuePerConversion: 0,
      conversionRate: 0,
      postsPerDay: 0
    }
  };

  // Calculate daily trends
  const dailyData = {};
  revenue.forEach(r => {
    const date = r.period.startDate.toISOString().split('T')[0];
    if (!dailyData[date]) dailyData[date] = { revenue: 0, conversions: 0, posts: 0 };
    dailyData[date].revenue += r.revenue.attributed || 0;
  });

  conversions.forEach(c => {
    const date = c.conversionData.timestamp.toISOString().split('T')[0];
    if (!dailyData[date]) dailyData[date] = { revenue: 0, conversions: 0, posts: 0 };
    dailyData[date].revenue += c.revenue.attributed || c.conversionValue || 0;
    dailyData[date].conversions++;
  });

  posts.forEach(p => {
    const date = p.postedAt.toISOString().split('T')[0];
    if (!dailyData[date]) dailyData[date] = { revenue: 0, conversions: 0, posts: 0 };
    dailyData[date].posts++;
  });

  Object.entries(dailyData).forEach(([date, data]) => {
    trends.revenue.daily.push({ date, value: data.revenue });
    trends.conversions.daily.push({ date, value: data.conversions });
    trends.posts.daily.push({ date, value: data.posts });
  });

  // Calculate averages
  const totalRevenue = revenue.reduce((sum, r) => sum + (r.revenue.attributed || 0), 0) +
    conversions.reduce((sum, c) => sum + (c.revenue.attributed || c.conversionValue || 0), 0);
  const totalConversions = conversions.length;
  const totalPosts = posts.length;
  const totalDays = Math.max(1, (new Date() - new Date(revenue[0]?.period.startDate || new Date())) / (1000 * 60 * 60 * 24));

  trends.averages.revenuePerPost = totalPosts > 0 ? totalRevenue / totalPosts : 0;
  trends.averages.revenuePerConversion = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  trends.averages.conversionRate = totalPosts > 0 ? (totalConversions / totalPosts) * 100 : 0;
  trends.averages.postsPerDay = totalDays > 0 ? totalPosts / totalDays : 0;

  return trends;
}

/**
 * Generate forecast from trends
 */
function generateForecast(trends, days) {
  const forecast = [];
  const { averages } = trends;

  // Simple linear forecast based on averages
  const dailyRevenue = averages.revenuePerPost * averages.postsPerDay;
  const dailyGrowth = 0.02; // 2% daily growth assumption

  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const projectedRevenue = dailyRevenue * Math.pow(1 + dailyGrowth, i);
    const projectedConversions = (projectedRevenue / averages.revenuePerConversion) || 0;
    const projectedPosts = averages.postsPerDay;

    forecast.push({
      date,
      revenue: Math.round(projectedRevenue * 100) / 100,
      conversions: Math.round(projectedConversions),
      posts: Math.round(projectedPosts),
      confidence: Math.max(50, 100 - (i * 2)) // Decreases over time
    });
  }

  // Calculate totals
  const totalRevenue = forecast.reduce((sum, f) => sum + f.revenue, 0);
  const totalConversions = forecast.reduce((sum, f) => sum + f.conversions, 0);
  const totalPosts = forecast.reduce((sum, f) => sum + f.posts, 0);
  const averageConfidence = forecast.reduce((sum, f) => sum + f.confidence, 0) / forecast.length;

  return {
    daily: forecast,
    totals: {
      revenue: Math.round(totalRevenue * 100) / 100,
      conversions: Math.round(totalConversions),
      posts: Math.round(totalPosts)
    },
    averages: {
      dailyRevenue: Math.round((totalRevenue / days) * 100) / 100,
      dailyConversions: Math.round((totalConversions / days) * 100) / 100,
      dailyPosts: Math.round((totalPosts / days) * 100) / 100
    },
    confidence: Math.round(averageConfidence)
  };
}

/**
 * Calculate forecast confidence
 */
function calculateConfidence(revenueDataPoints, conversionDataPoints) {
  // More data points = higher confidence
  const dataPoints = revenueDataPoints + conversionDataPoints;
  if (dataPoints >= 30) return 85;
  if (dataPoints >= 15) return 70;
  if (dataPoints >= 7) return 55;
  return 40;
}

module.exports = {
  forecastRevenue
};


