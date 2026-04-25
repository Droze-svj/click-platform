// Content Recommendation Service
// AI-powered content recommendations

const ContentRecommendation = require('../models/ContentRecommendation');
const ContentPerformance = require('../models/ContentPerformance');
const { getTopPerformingPosts } = require('./topPerformingPostsService');
const logger = require('../utils/logger');

/**
 * Generate content recommendations
 */
async function generateContentRecommendations(workspaceId, filters = {}) {
  try {
    const {
      platform = null,
      types = ['format', 'topic', 'timing', 'mix']
    } = filters;

    const recommendations = [];

    // Get top performing posts
    const topPosts = await getTopPerformingPosts(workspaceId, {
      limit: 20,
      platform
    });

    // Generate format recommendations
    if (types.includes('format')) {
      const formatRec = await generateFormatRecommendation(workspaceId, platform, topPosts);
      if (formatRec) recommendations.push(formatRec);
    }

    // Generate topic recommendations
    if (types.includes('topic')) {
      const topicRec = await generateTopicRecommendation(workspaceId, platform, topPosts);
      if (topicRec) recommendations.push(topicRec);
    }

    // Generate timing recommendations
    if (types.includes('timing')) {
      const timingRec = await generateTimingRecommendation(workspaceId, platform);
      if (timingRec) recommendations.push(timingRec);
    }

    // Generate mix recommendations
    if (types.includes('mix')) {
      const mixRec = await generateMixRecommendation(workspaceId, platform);
      if (mixRec) recommendations.push(mixRec);
    }

    // Save recommendations
    const savedRecommendations = await Promise.all(
      recommendations.map(rec => {
        const recommendation = new ContentRecommendation({
          workspaceId,
          platform,
          ...rec
        });
        return recommendation.save();
      })
    );

    logger.info('Content recommendations generated', { workspaceId, count: savedRecommendations.length });
    return savedRecommendations;
  } catch (error) {
    logger.error('Error generating content recommendations', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Generate format recommendation
 */
async function generateFormatRecommendation(workspaceId, platform, topPosts) {
  const formatPerformance = {};
  
  topPosts.posts.forEach(post => {
    const format = post.content?.format || 'unknown';
    if (!formatPerformance[format]) {
      formatPerformance[format] = { count: 0, totalScore: 0 };
    }
    formatPerformance[format].count++;
    formatPerformance[format].totalScore += post.scores.overall || 0;
  });

  const bestFormat = Object.entries(formatPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0];

  if (!bestFormat) return null;

  const currentMix = await getCurrentFormatMix(workspaceId, platform);
  const recommendedPercentage = 40; // Recommend 40% of content in best format

  return {
    type: 'format',
    recommendation: {
      title: `Increase ${bestFormat[0]} Content`,
      description: `${bestFormat[0]} content performs ${((bestFormat[1].totalScore / bestFormat[1].count) / 50).toFixed(1)}x better than average`,
      priority: 'high',
      confidence: 85,
      expectedImpact: {
        engagement: Math.round((bestFormat[1].totalScore / bestFormat[1].count) * 0.3),
        clicks: Math.round((bestFormat[1].totalScore / bestFormat[1].count) * 0.2),
        conversions: Math.round((bestFormat[1].totalScore / bestFormat[1].count) * 0.1)
      }
    },
    data: {
      topPerformers: topPosts.posts.slice(0, 5).map(p => ({
        postId: p.postId,
        metric: 'overall',
        value: p.scores.overall
      })),
      benchmarks: {
        currentMix,
        recommendedMix: { [bestFormat[0]]: recommendedPercentage }
      }
    },
    actions: [
      {
        action: 'increase_format',
        description: `Increase ${bestFormat[0]} content to ${recommendedPercentage}% of total`,
        priority: 'high'
      }
    ]
  };
}

/**
 * Generate topic recommendation
 */
async function generateTopicRecommendation(workspaceId, platform, topPosts) {
  const topicPerformance = {};
  
  topPosts.posts.forEach(post => {
    const topics = post.content?.topics || [];
    topics.forEach(topic => {
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { count: 0, totalScore: 0 };
      }
      topicPerformance[topic].count++;
      topicPerformance[topic].totalScore += post.scores.overall || 0;
    });
  });

  const bestTopic = Object.entries(topicPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0];

  if (!bestTopic) return null;

  return {
    type: 'topic',
    recommendation: {
      title: `Focus on ${bestTopic[0]} Content`,
      description: `Posts about ${bestTopic[0]} generate ${((bestTopic[1].totalScore / bestTopic[1].count) / 50).toFixed(1)}x more engagement`,
      priority: 'high',
      confidence: 80,
      expectedImpact: {
        engagement: Math.round((bestTopic[1].totalScore / bestTopic[1].count) * 0.4),
        clicks: Math.round((bestTopic[1].totalScore / bestTopic[1].count) * 0.3),
        conversions: Math.round((bestTopic[1].totalScore / bestTopic[1].count) * 0.15)
      }
    },
    data: {
      topPerformers: topPosts.posts.slice(0, 5).map(p => ({
        postId: p.postId,
        metric: 'engagement',
        value: p.performance.engagement
      }))
    },
    actions: [
      {
        action: 'create_topic_content',
        description: `Create 3-5 posts about ${bestTopic[0]} this week`,
        priority: 'high'
      }
    ]
  };
}

/**
 * Generate timing recommendation
 */
async function generateTimingRecommendation(workspaceId, platform) {
  // Get posting cadence data
  const PostingCadence = require('../models/PostingCadence');
  const cadence = await PostingCadence.findOne({
    workspaceId,
    platform: platform || 'all'
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!cadence || !cadence.optimal) {
    return null;
  }

  return {
    type: 'timing',
    recommendation: {
      title: 'Optimize Posting Times',
      description: `Post on ${cadence.optimal.bestPostingDays.join(', ')} at ${cadence.optimal.bestPostingTimes.join(':00, ')}:00 for best results`,
      priority: 'medium',
      confidence: 75,
      expectedImpact: {
        engagement: 15,
        clicks: 10,
        conversions: 5
      }
    },
    data: {
      trends: {
        bestDays: cadence.optimal.bestPostingDays,
        bestTimes: cadence.optimal.bestPostingTimes
      }
    },
    actions: [
      {
        action: 'schedule_optimal_times',
        description: 'Schedule future posts at recommended times',
        priority: 'medium'
      }
    ]
  };
}

/**
 * Generate mix recommendation
 */
async function generateMixRecommendation(workspaceId, platform) {
  const PostingCadence = require('../models/PostingCadence');
  const cadence = await PostingCadence.findOne({
    workspaceId,
    platform: platform || 'all'
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!cadence || !cadence.optimal) {
    return null;
  }

  return {
    type: 'mix',
    recommendation: {
      title: 'Optimize Content Mix',
      description: 'Adjust content mix based on performance data',
      priority: 'medium',
      confidence: 70,
      expectedImpact: {
        engagement: 20,
        clicks: 15,
        conversions: 8
      }
    },
    data: {
      benchmarks: {
        currentMix: cadence.contentMix,
        recommendedMix: cadence.optimal.recommendedMix
      }
    },
    actions: [
      {
        action: 'adjust_content_mix',
        description: 'Gradually adjust content mix to recommended percentages',
        priority: 'medium'
      }
    ]
  };
}

/**
 * Get current format mix
 */
async function getCurrentFormatMix(workspaceId, platform) {
  const query = { workspaceId };
  if (platform) query.platform = platform;

  const performances = await ContentPerformance.find(query)
    .limit(100)
    .lean();

  const formatCounts = {};
  performances.forEach(p => {
    const format = p.content?.format || 'unknown';
    formatCounts[format] = (formatCounts[format] || 0) + 1;
  });

  const total = performances.length;
  return Object.entries(formatCounts).map(([format, count]) => ({
    format,
    percentage: (count / total) * 100
  }));
}

/**
 * Get recommendations
 */
async function getContentRecommendations(workspaceId, filters = {}) {
  try {
    const {
      status = 'pending',
      type = null,
      priority = null
    } = filters;

    const query = { workspaceId };
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query['recommendation.priority'] = priority;

    const recommendations = await ContentRecommendation.find(query)
      .sort({ 'recommendation.priority': 1, createdAt: -1 })
      .lean();

    return recommendations;
  } catch (error) {
    logger.error('Error getting content recommendations', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  generateContentRecommendations,
  getContentRecommendations
};


