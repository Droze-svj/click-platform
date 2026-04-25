// Top Performing Posts Service
// Analyze top-performing posts by engagement, clicks, conversions

const ContentPerformance = require('../models/ContentPerformance');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get top performing posts
 */
async function getTopPerformingPosts(workspaceId, filters = {}) {
  try {
    const {
      metric = 'overall', // 'engagement', 'clicks', 'conversions', 'revenue', 'overall'
      limit = 10,
      platform = null,
      startDate = null,
      endDate = null,
      format = null,
      type = null,
      topic = null
    } = filters;

    const query = { workspaceId };
    if (platform) query.platform = platform;
    if (format) query['content.format'] = format;
    if (type) query['content.type'] = type;
    if (topic) query['content.topics'] = topic;
    if (startDate || endDate) {
      query.postedAt = {};
      if (startDate) query.postedAt.$gte = new Date(startDate);
      if (endDate) query.postedAt.$lte = new Date(endDate);
    }

    // Determine sort field based on metric
    let sortField = 'scores.overall';
    if (metric === 'engagement') sortField = 'performance.engagement';
    else if (metric === 'clicks') sortField = 'performance.clicks';
    else if (metric === 'conversions') sortField = 'performance.conversions';
    else if (metric === 'revenue') sortField = 'performance.revenue';

    const topPosts = await ContentPerformance.find(query)
      .sort({ [sortField]: -1 })
      .limit(limit)
      .populate('postId', 'content platform postedAt')
      .populate('contentId', 'title type')
      .lean();

    // Get detailed insights
    const insights = await analyzeTopPosts(topPosts, metric);

    return {
      posts: topPosts,
      insights,
      summary: {
        totalPosts: topPosts.length,
        metric,
        averageScore: topPosts.length > 0
          ? topPosts.reduce((sum, p) => sum + (p.scores.overall || 0), 0) / topPosts.length
          : 0
      }
    };
  } catch (error) {
    logger.error('Error getting top performing posts', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Analyze top posts for insights
 */
async function analyzeTopPosts(posts, metric) {
  const insights = {
    formats: {},
    types: {},
    topics: {},
    platforms: {},
    commonElements: []
  };

  posts.forEach(post => {
    // Format analysis
    const format = post.content?.format || 'unknown';
    if (!insights.formats[format]) {
      insights.formats[format] = { count: 0, averageScore: 0, totalScore: 0 };
    }
    insights.formats[format].count++;
    insights.formats[format].totalScore += post.scores.overall || 0;

    // Type analysis
    const type = post.content?.type || 'unknown';
    if (!insights.types[type]) {
      insights.types[type] = { count: 0, averageScore: 0, totalScore: 0 };
    }
    insights.types[type].count++;
    insights.types[type].totalScore += post.scores.overall || 0;

    // Topic analysis
    const topics = post.content?.topics || [];
    topics.forEach(topic => {
      if (!insights.topics[topic]) {
        insights.topics[topic] = { count: 0, averageScore: 0, totalScore: 0 };
      }
      insights.topics[topic].count++;
      insights.topics[topic].totalScore += post.scores.overall || 0;
    });

    // Platform analysis
    const platform = post.platform || 'unknown';
    if (!insights.platforms[platform]) {
      insights.platforms[platform] = { count: 0, averageScore: 0, totalScore: 0 };
    }
    insights.platforms[platform].count++;
    insights.platforms[platform].totalScore += post.scores.overall || 0;
  });

  // Calculate averages
  Object.keys(insights.formats).forEach(format => {
    insights.formats[format].averageScore = insights.formats[format].totalScore / insights.formats[format].count;
  });

  Object.keys(insights.types).forEach(type => {
    insights.types[type].averageScore = insights.types[type].totalScore / insights.types[type].count;
  });

  Object.keys(insights.topics).forEach(topic => {
    insights.topics[topic].averageScore = insights.topics[topic].totalScore / insights.topics[topic].count;
  });

  Object.keys(insights.platforms).forEach(platform => {
    insights.platforms[platform].averageScore = insights.platforms[platform].totalScore / insights.platforms[platform].count;
  });

  // Find best performers
  const bestFormat = Object.entries(insights.formats)
    .sort((a, b) => b[1].averageScore - a[1].averageScore)[0];
  const bestType = Object.entries(insights.types)
    .sort((a, b) => b[1].averageScore - a[1].averageScore)[0];
  const bestTopic = Object.entries(insights.topics)
    .sort((a, b) => b[1].averageScore - a[1].averageScore)[0];

  insights.commonElements = [
    { element: 'format', value: bestFormat?.[0], score: bestFormat?.[1]?.averageScore || 0 },
    { element: 'type', value: bestType?.[0], score: bestType?.[1]?.averageScore || 0 },
    { element: 'topic', value: bestTopic?.[0], score: bestTopic?.[1]?.averageScore || 0 }
  ];

  return insights;
}

/**
 * Update content performance for a post
 */
async function updateContentPerformance(postId) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post) {
      throw new Error('Post not found');
    }

    const analytics = post.analytics || {};
    const content = post.contentId || {};

    // Calculate performance scores
    const scores = {
      engagement: calculateEngagementScore(analytics),
      clickThrough: calculateCTRScore(analytics),
      conversion: calculateConversionScore(analytics),
      overall: 0
    };

    // Overall score (weighted)
    scores.overall = Math.round(
      scores.engagement * 0.4 +
      scores.clickThrough * 0.3 +
      scores.conversion * 0.3
    );

    // Get rankings
    const rankings = await calculateRankings(post.workspaceId, post.platform, {
      engagement: analytics.engagement || 0,
      clicks: analytics.clicks || 0,
      conversions: analytics.conversions || 0,
      revenue: analytics.revenue || 0,
      overall: scores.overall
    });

    // Create or update content performance
    const performance = await ContentPerformance.findOneAndUpdate(
      { postId },
      {
        $set: {
          postId,
          contentId: post.contentId?._id,
          workspaceId: post.workspaceId,
          platform: post.platform,
          content: {
            format: detectFormat(post, content),
            type: content.type || 'post',
            topics: extractTopics(post, content),
            category: content.category,
            hashtags: post.content?.hashtags || []
          },
          performance: {
            engagement: analytics.engagement || 0,
            clicks: analytics.clicks || 0,
            conversions: analytics.conversions || 0,
            revenue: analytics.revenue || 0,
            impressions: analytics.impressions || 0,
            reach: analytics.reach || 0
          },
          scores,
          rankings,
          postedAt: post.postedAt || post.scheduledTime
        }
      },
      { upsert: true, new: true }
    );

    return performance;
  } catch (error) {
    logger.error('Error updating content performance', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate engagement score
 */
function calculateEngagementScore(analytics) {
  const engagement = analytics.engagement || 0;
  const reach = analytics.reach || 0;
  const impressions = analytics.impressions || 0;

  if (reach > 0) {
    const rate = (engagement / reach) * 100;
    return Math.min(100, (rate / 5) * 100); // 5% engagement = 100 score
  } else if (impressions > 0) {
    const rate = (engagement / impressions) * 100;
    return Math.min(100, (rate / 3) * 100); // 3% engagement = 100 score
  }

  return 0;
}

/**
 * Calculate CTR score
 */
function calculateCTRScore(analytics) {
  const clicks = analytics.clicks || 0;
  const impressions = analytics.impressions || 0;
  const reach = analytics.reach || 0;

  if (impressions > 0) {
    const ctr = (clicks / impressions) * 100;
    return Math.min(100, (ctr / 2) * 100); // 2% CTR = 100 score
  } else if (reach > 0) {
    const ctr = (clicks / reach) * 100;
    return Math.min(100, (ctr / 3) * 100); // 3% CTR = 100 score
  }

  return 0;
}

/**
 * Calculate conversion score
 */
function calculateConversionScore(analytics) {
  const conversions = analytics.conversions || 0;
  const clicks = analytics.clicks || 0;

  if (clicks > 0) {
    const rate = (conversions / clicks) * 100;
    return Math.min(100, (rate / 5) * 100); // 5% conversion rate = 100 score
  }

  return 0;
}

/**
 * Calculate rankings
 */
async function calculateRankings(workspaceId, platform, metrics) {
  const query = { workspaceId, platform };

  const totalPosts = await ContentPerformance.countDocuments(query);

  const rankings = {
    byEngagement: null,
    byClicks: null,
    byConversions: null,
    byRevenue: null,
    overall: null
  };

  if (totalPosts > 0) {
    rankings.byEngagement = await ContentPerformance.countDocuments({
      ...query,
      'performance.engagement': { $gt: metrics.engagement }
    }) + 1;

    rankings.byClicks = await ContentPerformance.countDocuments({
      ...query,
      'performance.clicks': { $gt: metrics.clicks }
    }) + 1;

    rankings.byConversions = await ContentPerformance.countDocuments({
      ...query,
      'performance.conversions': { $gt: metrics.conversions }
    }) + 1;

    rankings.byRevenue = await ContentPerformance.countDocuments({
      ...query,
      'performance.revenue': { $gt: metrics.revenue }
    }) + 1;

    rankings.overall = await ContentPerformance.countDocuments({
      ...query,
      'scores.overall': { $gt: metrics.overall }
    }) + 1;
  }

  return rankings;
}

/**
 * Detect content format
 */
function detectFormat(post, content) {
  if (content.type === 'video') return 'video';
  if (post.content?.mediaUrl) {
    // Could check if multiple images for carousel
    return 'image';
  }
  if (post.content?.text && post.content?.mediaUrl) return 'link';
  return 'text';
}

/**
 * Extract topics
 */
function extractTopics(post, content) {
  const topics = [];

  // From hashtags
  if (post.content?.hashtags) {
    topics.push(...post.content.hashtags);
  }

  // From content tags
  if (content.tags) {
    topics.push(...content.tags);
  }

  // From category
  if (content.category) {
    topics.push(content.category);
  }

  return [...new Set(topics)]; // Remove duplicates
}

module.exports = {
  getTopPerformingPosts,
  updateContentPerformance
};


