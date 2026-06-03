// Business Intelligence Service

const Content = require('../models/Content');
const User = require('../models/User');
const ScheduledPost = require('../models/ScheduledPost');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get comprehensive business metrics
 */
async function getBusinessMetrics(userId, period = 30) {
  try {
    const cacheKey = `bi:metrics:${userId}:${period}`;
    
    return await getOrSet(cacheKey, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const [
        totalContent,
        contentByType,
        contentByStatus,
        scheduledPosts,
        activeUsers,
        engagementMetrics,
        revenueMetrics,
      ] = await Promise.all([
        getTotalContent(userId, startDate),
        getContentByType(userId, startDate),
        getContentByStatus(userId, startDate),
        getScheduledPosts(userId, startDate),
        getActiveUsers(startDate),
        getEngagementMetrics(userId, startDate),
        getRevenueMetrics(userId, startDate),
      ]);

      return {
        period,
        generatedAt: new Date(),
        content: {
          total: totalContent,
          byType: contentByType,
          byStatus: contentByStatus,
        },
        scheduling: scheduledPosts,
        users: activeUsers,
        engagement: engagementMetrics,
        revenue: revenueMetrics,
      };
    }, 1800); // Cache for 30 minutes
  } catch (error) {
    logger.error('Get business metrics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get total content count
 */
async function getTotalContent(userId, startDate) {
  const total = await Content.countDocuments({
    userId,
    createdAt: { $gte: startDate },
  });

  const previousPeriod = new Date(startDate);
  previousPeriod.setDate(previousPeriod.getDate() - (new Date() - startDate) / (1000 * 60 * 60 * 24));
  
  const previousTotal = await Content.countDocuments({
    userId,
    createdAt: { $gte: previousPeriod, $lt: startDate },
  });

  const growth = previousTotal > 0
    ? ((total - previousTotal) / previousTotal) * 100
    : 0;

  return {
    count: total,
    previousCount: previousTotal,
    growth: Math.round(growth * 100) / 100,
  };
}

/**
 * Get content by type
 */
async function getContentByType(userId, startDate) {
  const pipeline = [
    {
      $match: {
        userId: userId,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ];

  const results = await Content.aggregate(pipeline);
  return results.map(r => ({
    type: r._id,
    count: r.count,
  }));
}

/**
 * Get content by status
 */
async function getContentByStatus(userId, startDate) {
  const pipeline = [
    {
      $match: {
        userId: userId,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ];

  const results = await Content.aggregate(pipeline);
  return results.map(r => ({
    status: r._id,
    count: r.count,
  }));
}

/**
 * Get scheduled posts metrics
 */
async function getScheduledPosts(userId, startDate) {
  const [
    total,
    byPlatform,
    byStatus,
    upcoming,
  ] = await Promise.all([
    ScheduledPost.countDocuments({
      userId,
      createdAt: { $gte: startDate },
    }),
    ScheduledPost.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
        },
      },
    ]),
    ScheduledPost.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    ScheduledPost.countDocuments({
      userId,
      scheduledTime: { $gte: new Date() },
      status: 'scheduled',
    }),
  ]);

  return {
    total,
    byPlatform: byPlatform.map(r => ({ platform: r._id, count: r.count })),
    byStatus: byStatus.map(r => ({ status: r._id, count: r.count })),
    upcoming,
  };
}

/**
 * Get active users
 */
async function getActiveUsers(startDate) {
  const active = await User.countDocuments({
    lastLogin: { $gte: startDate },
  });

  const total = await User.countDocuments();

  return {
    active,
    total,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
  };
}

/**
 * Get engagement metrics — real aggregation over the user's posted content.
 * ScheduledPost.userId is a String (ObjectId or Supabase UUID).
 */
async function getEngagementMetrics(userId, startDate) {
  try {
    const match = { userId: String(userId), status: 'posted' };
    if (startDate) match.postedAt = { $gte: startDate };

    const rows = await ScheduledPost.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalViews: { $sum: { $ifNull: ['$analytics.engagementBreakdown.views', 0] } },
          totalEngagement: { $sum: { $ifNull: ['$analytics.engagement', 0] } },
          totalReach: { $sum: { $ifNull: ['$analytics.reach', 0] } },
        },
      },
    ]);
    const r = rows[0] || {};
    const totalViews = r.totalViews || 0;
    const totalEngagement = r.totalEngagement || 0;
    const totalReach = r.totalReach || 0;
    const averageEngagementRate = totalReach > 0
      ? parseFloat(((totalEngagement / totalReach) * 100).toFixed(2))
      : 0;

    const top = await ScheduledPost.find(match)
      .select('platform analytics.engagement analytics.reach postedAt')
      .sort({ 'analytics.engagement': -1 })
      .limit(5)
      .lean();
    const topPerformingContent = (top || []).map((p) => ({
      id: String(p._id),
      platform: p.platform,
      engagement: p.analytics?.engagement || 0,
      reach: p.analytics?.reach || 0,
      postedAt: p.postedAt,
    }));

    return { totalViews, totalEngagement, averageEngagementRate, topPerformingContent };
  } catch (error) {
    logger.error('Get engagement metrics error', { error: error.message, userId });
    return { totalViews: 0, totalEngagement: 0, averageEngagementRate: 0, topPerformingContent: [] };
  }
}

/**
 * Get revenue metrics — real aggregation over completed billing records.
 * Scoped to a single user when `userId` is provided; otherwise platform-wide.
 * BillingHistory.userId is an ObjectId.
 */
async function getRevenueMetrics(userId, startDate) {
  try {
    const BillingHistory = require('../models/BillingHistory');
    const { ensureObjectId } = require('../utils/devUser');

    const match = { 'payment.status': 'completed' };
    if (userId) match.userId = ensureObjectId(userId);
    if (startDate) match['invoice.date'] = { $gte: startDate };

    const totalAgg = await BillingHistory.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$invoice.amount.total', 0] } } } },
    ]);
    const totalRevenue = totalAgg[0]?.total || 0;

    // MRR proxy: completed billing in the trailing 30 days.
    const mrrSince = new Date();
    mrrSince.setDate(mrrSince.getDate() - 30);
    const mrrAgg = await BillingHistory.aggregate([
      { $match: { ...match, 'invoice.date': { $gte: mrrSince } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$invoice.amount.total', 0] } } } },
    ]);
    const monthlyRecurringRevenue = mrrAgg[0]?.total || 0;

    let averageRevenuePerUser = totalRevenue; // single-user scope
    let subscriptionBreakdown = [];
    if (!userId) {
      const payingUsers = await BillingHistory.distinct('userId', match);
      averageRevenuePerUser = payingUsers.length > 0
        ? parseFloat((totalRevenue / payingUsers.length).toFixed(2))
        : 0;
      subscriptionBreakdown = await User.aggregate([
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
        { $project: { _id: 0, plan: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ]);
    }

    return { totalRevenue, monthlyRecurringRevenue, averageRevenuePerUser, subscriptionBreakdown };
  } catch (error) {
    logger.error('Get revenue metrics error', { error: error.message, userId });
    return { totalRevenue: 0, monthlyRecurringRevenue: 0, averageRevenuePerUser: 0, subscriptionBreakdown: [] };
  }
}

/**
 * Get trends over time
 */
async function getTrends(userId, period = 30, granularity = 'day') {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const pipeline = [
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: granularity === 'day' ? '%Y-%m-%d' : '%Y-%m',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    const results = await Content.aggregate(pipeline);
    return results.map(r => ({
      date: r._id,
      count: r.count,
    }));
  } catch (error) {
    logger.error('Get trends error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Export data for BI tools
 */
async function exportDataForBI(userId, format = 'json') {
  try {
    const metrics = await getBusinessMetrics(userId, 90);
    
    if (format === 'csv') {
      // Convert to CSV format
      return convertToCSV(metrics);
    }
    
    return metrics;
  } catch (error) {
    logger.error('Export BI data error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Convert metrics to CSV
 */
function convertToCSV(data) {
  // Simple CSV conversion
  // In production, use a proper CSV library
  const lines = [];
  lines.push('Metric,Value');
  
  if (data.content) {
    lines.push(`Total Content,${data.content.total.count}`);
    data.content.byType.forEach(item => {
      lines.push(`Content - ${item.type},${item.count}`);
    });
  }
  
  return lines.join('\n');
}

module.exports = {
  getBusinessMetrics,
  getTrends,
  exportDataForBI,
};






