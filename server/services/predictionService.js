// Predictive Analytics Service - ML-powered predictions for content performance

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const { get } = require('./cacheService');

/**
 * Predict content performance based on historical data
 * @param {string} contentId - Content ID
 * @param {Object} contentData - Content data (title, description, type, etc.)
 * @returns {Promise<Object>} Performance predictions
 */
async function predictContentPerformance(contentId, contentData) {
  try {
    // Check cache first
    const cacheKey = `prediction:content:${contentId}`;
    const cached = await get(cacheKey);
    if (cached) {
      return cached;
    }

    logger.info('Predicting content performance', { contentId });

    // Get historical performance data
    const historicalData = await getHistoricalPerformance(contentData);

    // Calculate predictions
    const predictions = {
      estimatedViews: predictViews(contentData, historicalData),
      estimatedEngagement: predictEngagement(contentData, historicalData),
      estimatedReach: predictReach(contentData, historicalData),
      optimalPostingTime: await predictOptimalPostingTime(contentData),
      performanceScore: calculatePerformanceScore(contentData, historicalData),
      confidence: calculateConfidence(historicalData),
      recommendations: generateRecommendations(contentData, historicalData),
    };

    // Cache predictions (1 hour TTL)
    const { set } = require('./cacheService');
    await set(cacheKey, predictions, 3600);

    logger.info('Content performance predicted', {
      contentId,
      estimatedViews: predictions.estimatedViews,
      performanceScore: predictions.performanceScore,
    });

    return predictions;
  } catch (error) {
    logger.error('Error predicting content performance', {
      contentId,
      error: error.message,
    });
    captureException(error, {
      tags: { service: 'predictionService', action: 'predictContentPerformance' },
    });
    throw error;
  }
}

/**
 * Get historical performance data for similar content
 */
async function getHistoricalPerformance(contentData) {
  try {
    const { userId, type, category, tags } = contentData;

    // Get user's historical content performance
    const historicalContent = await ContentPerformance.find({
      userId,
      ...(type && { 'content.type': type }),
      ...(category && { 'content.category': category }),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate averages
    const avgViews =
      historicalContent.reduce((sum, item) => sum + (item.views || 0), 0) /
      Math.max(historicalContent.length, 1);
    const avgEngagement =
      historicalContent.reduce((sum, item) => sum + (item.engagement || 0), 0) /
      Math.max(historicalContent.length, 1);
    const avgReach =
      historicalContent.reduce((sum, item) => sum + (item.reach || 0), 0) /
      Math.max(historicalContent.length, 1);

    return {
      count: historicalContent.length,
      avgViews,
      avgEngagement,
      avgReach,
      data: historicalContent,
    };
  } catch (error) {
    logger.error('Error getting historical performance', { error: error.message });
    return {
      count: 0,
      avgViews: 0,
      avgEngagement: 0,
      avgReach: 0,
      data: [],
    };
  }
}

/**
 * Predict views based on content data and historical performance
 */
function predictViews(contentData, historicalData) {
  if (historicalData.count === 0) {
    // No historical data, use default estimates
    return {
      min: 50,
      max: 500,
      expected: 200,
    };
  }

  const baseViews = historicalData.avgViews;
  const variance = baseViews * 0.3; // 30% variance

  // Adjust based on content type
  const typeMultiplier = {
    video: 1.5,
    article: 1.0,
    podcast: 0.8,
    transcript: 0.6,
  }[contentData.type] || 1.0;

  // Adjust based on title length (optimal: 40-60 chars)
  const titleLength = contentData.title?.length || 0;
  const titleMultiplier =
    titleLength >= 40 && titleLength <= 60 ? 1.2 : titleLength > 0 ? 1.0 : 0.8;

  const expected = baseViews * typeMultiplier * titleMultiplier;

  return {
    min: Math.max(0, expected - variance),
    max: expected + variance,
    expected: Math.round(expected),
  };
}

/**
 * Predict engagement based on content data
 */
function predictEngagement(contentData, historicalData) {
  if (historicalData.count === 0) {
    return {
      min: 5,
      max: 50,
      expected: 20,
      rate: 0.05, // 5% engagement rate
    };
  }

  const baseEngagement = historicalData.avgEngagement;
  const baseViews = historicalData.avgViews;
  const baseEngagementRate = baseViews > 0 ? baseEngagement / baseViews : 0.05;

  // Adjust based on content quality indicators
  const hasDescription = contentData.description && contentData.description.length > 100;
  const hasTags = contentData.tags && contentData.tags.length > 0;
  const qualityMultiplier = (hasDescription ? 1.1 : 1.0) * (hasTags ? 1.1 : 1.0);

  const expectedEngagement = baseEngagement * qualityMultiplier;
  const expectedRate = baseEngagementRate * qualityMultiplier;

  return {
    min: Math.max(0, expectedEngagement * 0.7),
    max: expectedEngagement * 1.3,
    expected: Math.round(expectedEngagement),
    rate: Math.min(1.0, expectedRate),
  };
}

/**
 * Predict reach based on content data
 */
function predictReach(contentData, historicalData) {
  if (historicalData.count === 0) {
    return {
      min: 30,
      max: 400,
      expected: 150,
    };
  }

  const baseReach = historicalData.avgReach;
  const variance = baseReach * 0.25;

  // Reach is typically 60-80% of views
  const viewsPrediction = predictViews(contentData, historicalData);
  const reachFromViews = viewsPrediction.expected * 0.7;

  const expected = Math.max(baseReach, reachFromViews);

  return {
    min: Math.max(0, expected - variance),
    max: expected + variance,
    expected: Math.round(expected),
  };
}

/**
 * Predict optimal posting time
 */
async function predictOptimalPostingTime(contentData) {
  try {
    const { userId, platform } = contentData;

    // Get historical posting times and performance
    const posts = await ScheduledPost.find({
      userId,
      ...(platform && { platform }),
      status: 'posted',
    })
      .sort({ scheduledTime: -1 })
      .limit(50)
      .lean();

    if (posts.length === 0) {
      // Default optimal times by platform
      const defaultTimes = {
        instagram: { hour: 11, minute: 0 }, // 11 AM
        twitter: { hour: 9, minute: 0 }, // 9 AM
        linkedin: { hour: 8, minute: 0 }, // 8 AM
        facebook: { hour: 13, minute: 0 }, // 1 PM
        tiktok: { hour: 19, minute: 0 }, // 7 PM
      };

      return defaultTimes[platform] || { hour: 12, minute: 0 };
    }

    // Analyze best performing times
    const timePerformance = {};
    posts.forEach((post) => {
      const hour = new Date(post.scheduledTime).getHours();
      const engagement = post.analytics?.engagement || 0;
      if (!timePerformance[hour]) {
        timePerformance[hour] = { total: 0, count: 0 };
      }
      timePerformance[hour].total += engagement;
      timePerformance[hour].count += 1;
    });

    // Find hour with best average engagement
    let bestHour = 12;
    let bestAvg = 0;
    Object.entries(timePerformance).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = parseInt(hour);
      }
    });

    return {
      hour: bestHour,
      minute: 0,
      confidence: posts.length >= 10 ? 'high' : 'medium',
    };
  } catch (error) {
    logger.error('Error predicting optimal posting time', { error: error.message });
    return { hour: 12, minute: 0, confidence: 'low' };
  }
}

/**
 * Calculate overall performance score (0-100)
 */
function calculatePerformanceScore(contentData, historicalData) {
  let score = 50; // Base score

  // Title quality (0-20 points)
  const titleLength = contentData.title?.length || 0;
  if (titleLength >= 40 && titleLength <= 60) {
    score += 20;
  } else if (titleLength > 0) {
    score += 10;
  }

  // Description quality (0-15 points)
  if (contentData.description && contentData.description.length > 100) {
    score += 15;
  } else if (contentData.description) {
    score += 5;
  }

  // Tags (0-10 points)
  if (contentData.tags && contentData.tags.length >= 3) {
    score += 10;
  } else if (contentData.tags && contentData.tags.length > 0) {
    score += 5;
  }

  // Historical performance (0-15 points)
  if (historicalData.count > 0) {
    const avgEngagementRate =
      historicalData.avgViews > 0
        ? historicalData.avgEngagement / historicalData.avgViews
        : 0;
    if (avgEngagementRate > 0.1) {
      score += 15;
    } else if (avgEngagementRate > 0.05) {
      score += 10;
    } else {
      score += 5;
    }
  }

  // Content type (0-10 points)
  const typeScores = {
    video: 10,
    article: 8,
    podcast: 7,
    transcript: 5,
  };
  score += typeScores[contentData.type] || 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate prediction confidence
 */
function calculateConfidence(historicalData) {
  if (historicalData.count === 0) {
    return 'low';
  }
  if (historicalData.count >= 50) {
    return 'high';
  }
  if (historicalData.count >= 20) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate recommendations for improving content
 */
function generateRecommendations(contentData, historicalData) {
  const recommendations = [];

  // Title recommendations
  const titleLength = contentData.title?.length || 0;
  if (titleLength < 40) {
    recommendations.push({
      type: 'title',
      message: 'Consider making your title longer (40-60 characters for optimal engagement)',
      priority: 'medium',
    });
  } else if (titleLength > 60) {
    recommendations.push({
      type: 'title',
      message: 'Consider shortening your title (40-60 characters is optimal)',
      priority: 'low',
    });
  }

  // Description recommendations
  if (!contentData.description || contentData.description.length < 100) {
    recommendations.push({
      type: 'description',
      message: 'Add a detailed description (100+ characters) to improve engagement',
      priority: 'high',
    });
  }

  // Tags recommendations
  if (!contentData.tags || contentData.tags.length < 3) {
    recommendations.push({
      type: 'tags',
      message: 'Add at least 3-5 relevant tags to improve discoverability',
      priority: 'high',
    });
  }

  // Posting time recommendations
  if (historicalData.count > 0 && historicalData.avgEngagement < 10) {
    recommendations.push({
      type: 'timing',
      message: 'Consider posting at different times based on your audience activity',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Predict audience growth
 * @param {string} userId - User ID
 * @param {number} days - Number of days to predict
 * @returns {Promise<Object>} Growth predictions
 */
async function predictAudienceGrowth(userId, days = 30) {
  try {
    // Get historical growth data
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      'analytics.reach': { $exists: true },
    })
      .sort({ scheduledTime: -1 })
      .limit(100)
      .lean();

    if (posts.length === 0) {
      return {
        current: 0,
        predicted: 0,
        growthRate: 0,
        confidence: 'low',
      };
    }

    // Calculate average reach per post
    const avgReach =
      posts.reduce((sum, post) => sum + (post.analytics?.reach || 0), 0) / posts.length;

    // Estimate posts per day
    const daysOfData = Math.max(
      1,
      (Date.now() - new Date(posts[posts.length - 1].scheduledTime).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const postsPerDay = posts.length / daysOfData;

    // Predict growth
    const predictedReach = avgReach * postsPerDay * days;
    const growthRate = postsPerDay > 0 ? (avgReach / postsPerDay) * 100 : 0;

    return {
      current: avgReach,
      predicted: Math.round(predictedReach),
      growthRate: Math.round(growthRate * 100) / 100,
      confidence: posts.length >= 20 ? 'high' : posts.length >= 10 ? 'medium' : 'low',
    };
  } catch (error) {
    logger.error('Error predicting audience growth', { userId, error: error.message });
    throw error;
  }
}

module.exports = {
  predictContentPerformance,
  predictAudienceGrowth,
  getHistoricalPerformance,
};
