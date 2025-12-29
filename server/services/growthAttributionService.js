// Growth Attribution Service
// Track what content drives follower growth

const GrowthAttribution = require('../models/GrowthAttribution');
const ScheduledPost = require('../models/ScheduledPost');
const AudienceGrowth = require('../models/AudienceGrowth');
const logger = require('../utils/logger');

/**
 * Calculate growth attribution for period
 */
async function calculateGrowthAttribution(userId, platform, period) {
  try {
    const {
      startDate,
      endDate
    } = period;

    // Get growth snapshots for period
    const growthSnapshots = await AudienceGrowth.find({
      userId,
      platform,
      snapshotDate: { $gte: startDate, $lte: endDate }
    })
      .sort({ snapshotDate: 1 })
      .lean();

    if (growthSnapshots.length < 2) {
      throw new Error('Insufficient growth data for attribution');
    }

    const firstSnapshot = growthSnapshots[0];
    const lastSnapshot = growthSnapshots[growthSnapshots.length - 1];
    const totalGrowth = lastSnapshot.followers.current - firstSnapshot.followers.current;

    // Get posts in period (with a buffer for delayed growth)
    const postStartDate = new Date(startDate);
    postStartDate.setDate(postStartDate.getDate() - 7); // 7 days before for attribution

    const posts = await ScheduledPost.find({
      userId,
      platform,
      status: 'posted',
      postedAt: { $gte: postStartDate, $lte: endDate }
    })
      .sort({ postedAt: 1 })
      .lean();

    // Calculate attribution
    const topContent = [];
    const contentTypes = {};
    const topics = {};

    posts.forEach(post => {
      const analytics = post.analytics || {};
      const engagement = analytics.engagement || 0;
      const reach = analytics.reach || 0;
      const impressions = analytics.impressions || 0;

      // Correlation score (simplified - would use more sophisticated algorithm)
      const correlationScore = calculateCorrelationScore(engagement, reach, impressions);
      const attributedGrowth = Math.round(totalGrowth * (correlationScore / 100));

      topContent.push({
        postId: post._id,
        attributedGrowth,
        correlationScore,
        engagement,
        reach
      });

      // Content type attribution
      const contentType = post.contentId?.type || 'post';
      if (!contentTypes[contentType]) {
        contentTypes[contentType] = { attributedGrowth: 0, posts: 0 };
      }
      contentTypes[contentType].attributedGrowth += attributedGrowth;
      contentTypes[contentType].posts++;

      // Topic attribution (from tags/hashtags)
      const tags = post.content?.hashtags || [];
      tags.forEach(tag => {
        if (!topics[tag]) {
          topics[tag] = { attributedGrowth: 0, posts: 0 };
        }
        topics[tag].attributedGrowth += attributedGrowth / tags.length; // Distribute across tags
        topics[tag].posts++;
      });
    });

    // Sort top content
    topContent.sort((a, b) => b.attributedGrowth - a.attributedGrowth);

    // Create attribution record
    const attribution = new GrowthAttribution({
      userId,
      platform,
      period: {
        startDate,
        endDate
      },
      growth: {
        newFollowers: lastSnapshot.growth.newFollowers || 0,
        attributedToContent: topContent.reduce((sum, item) => sum + item.attributedGrowth, 0),
        attributedToEngagement: Math.round(totalGrowth * 0.3), // 30% attributed to overall engagement
        organic: Math.round(totalGrowth * 0.2) // 20% organic
      },
      topContent: topContent.slice(0, 10),
      contentTypes: Object.entries(contentTypes).map(([type, data]) => ({
        contentType: type,
        ...data
      })),
      topics: Object.entries(topics)
        .map(([topic, data]) => ({ topic, ...data }))
        .sort((a, b) => b.attributedGrowth - a.attributedGrowth)
        .slice(0, 10)
    });

    await attribution.save();

    logger.info('Growth attribution calculated', { userId, platform, totalGrowth });
    return attribution;
  } catch (error) {
    logger.error('Error calculating growth attribution', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Calculate correlation score
 */
function calculateCorrelationScore(engagement, reach, impressions) {
  // Simplified correlation - higher engagement and reach = higher correlation
  const engagementScore = Math.min(engagement / 100, 1) * 40; // Max 40 points
  const reachScore = Math.min(reach / 1000, 1) * 30; // Max 30 points
  const impressionScore = Math.min(impressions / 5000, 1) * 30; // Max 30 points

  return Math.round(engagementScore + reachScore + impressionScore);
}

/**
 * Forecast growth based on content performance
 */
async function forecastGrowth(userId, platform, days = 30) {
  try {
    // Get recent growth attribution
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const attribution = await GrowthAttribution.findOne({
      userId,
      platform,
      'period.startDate': { $gte: startDate, $lte: endDate }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!attribution) {
      // Calculate if doesn't exist
      const calculated = await calculateGrowthAttribution(userId, platform, { startDate, endDate });
      return await forecastFromAttribution(calculated, days);
    }

    return await forecastFromAttribution(attribution, days);
  } catch (error) {
    logger.error('Error forecasting growth', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Forecast from attribution data
 */
async function forecastFromAttribution(attribution, days) {
  const weeklyGrowth = attribution.growth.attributedToContent / 4; // Assuming 4 weeks
  const predictedGrowth = Math.round(weeklyGrowth * (days / 7));

  return {
    currentFollowers: 0, // Would get from latest snapshot
    predictedFollowers: 0, // Would calculate
    predictedGrowth,
    confidence: 65,
    factors: {
      topContentTypes: attribution.contentTypes.slice(0, 3),
      topTopics: attribution.topics.slice(0, 3),
      averageAttributionPerPost: attribution.topContent.length > 0
        ? attribution.growth.attributedToContent / attribution.topContent.length
        : 0
    }
  };
}

module.exports = {
  calculateGrowthAttribution,
  forecastGrowth
};


