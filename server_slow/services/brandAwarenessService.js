// Brand Awareness Service
// Track brand awareness indicators

const BrandAwareness = require('../models/BrandAwareness');
const AudienceGrowth = require('../models/AudienceGrowth');
const ScheduledPost = require('../models/ScheduledPost');
const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');
const logger = require('../utils/logger');

/**
 * Calculate brand awareness for a period
 */
async function calculateBrandAwareness(workspaceId, platform, period) {
  try {
    const {
      type = 'monthly',
      startDate,
      endDate
    } = period;

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    if (type === 'monthly') {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      prevEndDate.setMonth(prevEndDate.getMonth() - 1);
    } else if (type === 'weekly') {
      prevStartDate.setDate(prevStartDate.getDate() - 7);
      prevEndDate.setDate(prevEndDate.getDate() - 7);
    }

    // Get current period metrics
    const currentMetrics = await getAggregatedPerformanceMetrics(workspaceId, {
      platform,
      startDate,
      endDate
    });

    // Get previous period metrics
    const previousMetrics = await getAggregatedPerformanceMetrics(workspaceId, {
      platform,
      startDate: prevStartDate,
      endDate: prevEndDate
    });

    // Get audience growth
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(workspaceId).lean();
    const userId = workspace?.userId;

    let currentFollowers = 0;
    let previousFollowers = 0;
    let profileVisits = 0;
    let previousProfileVisits = 0;

    if (userId) {
      const currentGrowth = await AudienceGrowth.findOne({
        userId,
        platform,
        snapshotDate: { $gte: startDate, $lte: endDate }
      })
        .sort({ snapshotDate: -1 })
        .lean();

      const previousGrowth = await AudienceGrowth.findOne({
        userId,
        platform,
        snapshotDate: { $gte: prevStartDate, $lte: prevEndDate }
      })
        .sort({ snapshotDate: -1 })
        .lean();

      currentFollowers = currentGrowth?.followers.current || 0;
      previousFollowers = previousGrowth?.followers.current || 0;

      // Profile visits (would come from platform API)
      profileVisits = currentGrowth?.metadata?.profileVisits || 0;
      previousProfileVisits = previousGrowth?.metadata?.profileVisits || 0;
    }

    // Calculate growth percentages
    const followersGrowth = previousFollowers > 0
      ? ((currentFollowers - previousFollowers) / previousFollowers) * 100
      : 0;

    const profileVisitsGrowth = previousProfileVisits > 0
      ? ((profileVisits - previousProfileVisits) / previousProfileVisits) * 100
      : 0;

    const reachGrowth = previousMetrics.totalReach > 0
      ? ((currentMetrics.totalReach - previousMetrics.totalReach) / previousMetrics.totalReach) * 100
      : 0;

    // Calculate share of voice (simplified - would need competitor data)
    const shareOfVoice = await calculateShareOfVoice(workspaceId, platform, startDate, endDate);

    // Get brand mentions
    const mentions = await getBrandMentions(workspaceId, platform, startDate, endDate);

    // Create or update brand awareness
    const awareness = await BrandAwareness.findOneAndUpdate(
      {
        workspaceId,
        platform,
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type
      },
      {
        $set: {
          workspaceId,
          platform,
          period: {
            type,
            startDate,
            endDate
          },
          profile: {
            visits: profileVisits,
            visitsGrowth: profileVisitsGrowth,
            followers: currentFollowers,
            followersGrowth,
            profileViews: profileVisits, // Same as visits for now
            profileViewsGrowth: profileVisitsGrowth
          },
          reach: {
            total: currentMetrics.totalReach,
            growth: reachGrowth,
            unique: currentMetrics.totalReach * 0.9, // Estimate
            organic: currentMetrics.totalReach * 0.8, // Estimate
            paid: currentMetrics.totalReach * 0.2 // Estimate
          },
          shareOfVoice,
          mentions,
          awarenessScore: 0 // Will be calculated by pre-save hook
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Brand awareness calculated', { workspaceId, platform, awarenessScore: awareness.awarenessScore });
    return awareness;
  } catch (error) {
    logger.error('Error calculating brand awareness', { error: error.message, workspaceId, platform });
    throw error;
  }
}

/**
 * Calculate share of voice
 */
async function calculateShareOfVoice(workspaceId, platform, startDate, endDate) {
  // Simplified calculation - would need competitor data in production
  const posts = await ScheduledPost.find({
    workspaceId,
    platform,
    status: 'posted',
    postedAt: { $gte: startDate, $lte: endDate }
  }).lean();

  const hashtagMentions = posts.reduce((sum, post) => {
    return sum + (post.content?.hashtags?.length || 0);
  }, 0);

  // Estimate branded mentions (would need actual mention tracking)
  const brandedMentions = posts.length * 2; // Placeholder

  return {
    total: 15, // Placeholder percentage
    growth: 5, // Placeholder
    mentions: brandedMentions,
    hashtagMentions,
    brandedMentions,
    competitorComparison: [] // Would be populated with competitor data
  };
}

/**
 * Get brand mentions
 */
async function getBrandMentions(workspaceId, platform, startDate, endDate) {
  // Simplified - would need actual mention tracking
  const posts = await ScheduledPost.find({
    workspaceId,
    platform,
    status: 'posted',
    postedAt: { $gte: startDate, $lte: endDate }
  }).lean();

  // Estimate mentions based on engagement
  const totalEngagement = posts.reduce((sum, post) => {
    return sum + (post.analytics?.engagement || 0);
  }, 0);

  // Estimate sentiment (would use actual sentiment analysis)
  const positive = Math.round(totalEngagement * 0.6);
  const neutral = Math.round(totalEngagement * 0.3);
  const negative = Math.round(totalEngagement * 0.1);

  return {
    total: totalEngagement,
    positive,
    neutral,
    negative,
    sentiment: positive > negative ? 'positive' : (negative > positive ? 'negative' : 'neutral')
  };
}

/**
 * Get brand awareness trends
 */
async function getBrandAwarenessTrends(workspaceId, platform, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'monthly'
    } = filters;

    const query = {
      workspaceId,
      platform,
      'period.type': period
    };

    if (startDate || endDate) {
      query['period.startDate'] = {};
      if (startDate) query['period.startDate'].$gte = new Date(startDate);
      if (endDate) query['period.startDate'].$lte = new Date(endDate);
    }

    const awarenessData = await BrandAwareness.find(query)
      .sort({ 'period.startDate': 1 })
      .lean();

    const trends = {
      profileVisits: awarenessData.map(a => ({
        date: a.period.startDate,
        value: a.profile.visits,
        growth: a.profile.visitsGrowth
      })),
      reach: awarenessData.map(a => ({
        date: a.period.startDate,
        value: a.reach.total,
        growth: a.reach.growth
      })),
      shareOfVoice: awarenessData.map(a => ({
        date: a.period.startDate,
        value: a.shareOfVoice.total,
        growth: a.shareOfVoice.growth
      })),
      awarenessScore: awarenessData.map(a => ({
        date: a.period.startDate,
        value: a.awarenessScore
      }))
    };

    return {
      data: awarenessData,
      trends,
      summary: {
        currentScore: awarenessData[awarenessData.length - 1]?.awarenessScore || 0,
        averageScore: awarenessData.length > 0
          ? awarenessData.reduce((sum, a) => sum + a.awarenessScore, 0) / awarenessData.length
          : 0,
        trend: awarenessData.length >= 2
          ? awarenessData[awarenessData.length - 1].awarenessScore - awarenessData[0].awarenessScore
          : 0
      }
    };
  } catch (error) {
    logger.error('Error getting brand awareness trends', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  calculateBrandAwareness,
  getBrandAwarenessTrends
};


