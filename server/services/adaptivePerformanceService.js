// Adaptive Performance Prediction & ROI Forecasting Service
// Updates predictions as real data comes in

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Adaptive performance prediction that updates with real data
 */
async function getAdaptivePerformancePrediction(userId, contentId, platform) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Get initial prediction if available
    const pipeline = content.pipeline;
    const initialPrediction = pipeline?.performance?.[platform]?.[0] || null;

    // Get actual performance data
    const posts = await ScheduledPost.find({
      userId,
      contentId,
      platform,
      status: 'posted'
    }).sort({ postedAt: -1 }).lean();

    let prediction = {
      predictedEngagement: initialPrediction?.predictedEngagement || 0,
      predictedReach: initialPrediction?.predictedReach || 0,
      predictedROI: 0,
      confidence: 'low',
      basedOn: 'initial_prediction',
      actualData: null,
      adjustedPrediction: null,
      accuracy: null,
      forecast: null
    };

    // If we have actual data, adjust prediction
    if (posts.length > 0) {
      const actualEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / posts.length;
      const actualReach = posts.reduce((sum, p) => sum + (p.analytics?.reach || p.analytics?.impressions || 0), 0) / posts.length;

      prediction.actualData = {
        engagement: actualEngagement,
        reach: actualReach,
        posts: posts.length,
        lastUpdated: posts[0].postedAt
      };

      // Calculate accuracy
      if (initialPrediction) {
        const engagementError = Math.abs(actualEngagement - initialPrediction.predictedEngagement) / Math.max(actualEngagement, 1);
        const reachError = Math.abs(actualReach - initialPrediction.predictedReach) / Math.max(actualReach, 1);
        prediction.accuracy = {
          engagement: Math.round((1 - engagementError) * 100),
          reach: Math.round((1 - reachError) * 100),
          overall: Math.round((1 - (engagementError + reachError) / 2) * 100)
        };
      }

      // Adjust prediction based on actual performance
      prediction.adjustedPrediction = await adjustPredictionWithRealData(
        userId,
        content,
        platform,
        actualEngagement,
        actualReach,
        posts
      );

      prediction.confidence = posts.length >= 3 ? 'high' : posts.length >= 1 ? 'medium' : 'low';
      prediction.basedOn = `actual_data_${posts.length}_posts`;
    }

    // Generate forecast
    prediction.forecast = await generatePerformanceForecast(
      userId,
      content,
      platform,
      prediction.adjustedPrediction || prediction
    );

    // Calculate ROI
    prediction.predictedROI = await calculateROI(userId, content, platform, prediction);

    return prediction;
  } catch (error) {
    logger.error('Error getting adaptive performance prediction', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Adjust prediction based on real data
 */
async function adjustPredictionWithRealData(userId, content, platform, actualEngagement, actualReach, posts) {
  try {
    // Get similar content performance
    const similarContent = await Content.find({
      userId,
      type: content.type,
      category: content.category,
      _id: { $ne: content._id }
    }).limit(10).lean();

    const similarPostIds = similarContent.map(c => c._id);
    const similarPosts = await ScheduledPost.find({
      userId,
      contentId: { $in: similarPostIds },
      platform,
      status: 'posted'
    }).lean();

    // Calculate average performance of similar content
    let avgSimilarEngagement = 0;
    let avgSimilarReach = 0;
    if (similarPosts.length > 0) {
      avgSimilarEngagement = similarPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / similarPosts.length;
      avgSimilarReach = similarPosts.reduce((sum, p) => sum + (p.analytics?.reach || p.analytics?.impressions || 0), 0) / similarPosts.length;
    }

    // Weighted adjustment: 70% actual data, 30% similar content
    const adjustedEngagement = (actualEngagement * 0.7) + (avgSimilarEngagement * 0.3);
    const adjustedReach = (actualReach * 0.7) + (avgSimilarReach * 0.3);

    // Trend analysis
    const engagements = posts.map(p => p.analytics?.engagement || 0);
    const trend = calculateTrend(engagements);

    return {
      engagement: Math.round(adjustedEngagement),
      reach: Math.round(adjustedReach),
      trend: trend,
      confidence: posts.length >= 3 ? 'high' : 'medium',
      basedOn: {
        actualPosts: posts.length,
        similarContent: similarContent.length,
        trend: trend
      }
    };
  } catch (error) {
    logger.error('Error adjusting prediction', { error: error.message });
    return null;
  }
}

/**
 * Generate performance forecast
 */
async function generatePerformanceForecast(userId, content, platform, prediction) {
  try {
    const forecast = {
      nextWeek: {
        engagement: 0,
        reach: 0,
        confidence: 'low'
      },
      nextMonth: {
        engagement: 0,
        reach: 0,
        confidence: 'low'
      },
      trend: 'stable',
      factors: []
    };

    // Base forecast on current/adjusted prediction
    const baseEngagement = prediction.adjustedPrediction?.engagement || prediction.predictedEngagement || 0;
    const baseReach = prediction.adjustedPrediction?.reach || prediction.predictedReach || 0;

    // Apply trend if available
    const trend = prediction.adjustedPrediction?.trend || 'stable';
    let trendMultiplier = 1.0;

    if (trend === 'improving') {
      trendMultiplier = 1.1;
      forecast.trend = 'improving';
    } else if (trend === 'declining') {
      trendMultiplier = 0.9;
      forecast.trend = 'declining';
    }

    forecast.nextWeek = {
      engagement: Math.round(baseEngagement * trendMultiplier),
      reach: Math.round(baseReach * trendMultiplier),
      confidence: prediction.confidence
    };

    forecast.nextMonth = {
      engagement: Math.round(baseEngagement * trendMultiplier * 1.05),
      reach: Math.round(baseReach * trendMultiplier * 1.05),
      confidence: prediction.confidence === 'high' ? 'medium' : 'low'
    };

    // Add factors
    if (content.tags && content.tags.length >= 5) {
      forecast.factors.push('Strong hashtag strategy');
    }
    if (content.description && content.description.length > 100) {
      forecast.factors.push('Detailed description');
    }
    if (prediction.confidence === 'high') {
      forecast.factors.push('High confidence based on actual data');
    }

    return forecast;
  } catch (error) {
    logger.error('Error generating forecast', { error: error.message });
    return null;
  }
}

/**
 * Calculate ROI
 */
async function calculateROI(userId, content, platform, prediction) {
  try {
    // Get time investment (estimate)
    const timeInvestment = estimateTimeInvestment(content);

    // Get engagement value (estimate $0.10 per engagement)
    const engagementValue = (prediction.adjustedPrediction?.engagement || prediction.predictedEngagement || 0) * 0.10;

    // Calculate ROI
    const roi = timeInvestment > 0 ? ((engagementValue - timeInvestment) / timeInvestment) * 100 : 0;

    return {
      timeInvestment,
      engagementValue,
      roi: Math.round(roi),
      roiPercentage: Math.round(roi),
      breakEven: timeInvestment / 0.10
    };
  } catch (error) {
    logger.error('Error calculating ROI', { error: error.message });
    return { roi: 0, roiPercentage: 0 };
  }
}

/**
 * Estimate time investment
 */
function estimateTimeInvestment(content) {
  let time = 0;

  // Base time for content creation
  switch (content.type) {
    case 'video':
      time = 120; // 2 hours
      break;
    case 'article':
      time = 60; // 1 hour
      break;
    case 'podcast':
      time = 90; // 1.5 hours
      break;
    default:
      time = 30; // 30 minutes
  }

  // Add time for processing
  if (content.generatedContent) {
    time += 15; // 15 minutes for asset generation
  }

  return time; // in minutes
}

/**
 * Calculate trend from data points
 */
function calculateTrend(dataPoints) {
  if (dataPoints.length < 2) return 'stable';

  const recent = dataPoints.slice(0, Math.min(3, dataPoints.length));
  const older = dataPoints.slice(3, Math.min(6, dataPoints.length));

  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  if (recentAvg > olderAvg * 1.1) return 'improving';
  if (recentAvg < olderAvg * 0.9) return 'declining';
  return 'stable';
}

/**
 * Update predictions with new data
 */
async function updatePredictionsWithNewData(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
    const updatedPredictions = {};

    for (const platform of platforms) {
      const prediction = await getAdaptivePerformancePrediction(userId, contentId, platform);
      updatedPredictions[platform] = prediction;
    }

    // Update content pipeline with new predictions
    if (!content.pipeline) {
      content.pipeline = {};
    }
    if (!content.pipeline.performance) {
      content.pipeline.performance = {};
    }

    // Update with adjusted predictions
    for (const [platform, prediction] of Object.entries(updatedPredictions)) {
      if (prediction.adjustedPrediction) {
        if (!content.pipeline.performance[platform]) {
          content.pipeline.performance[platform] = [];
        }
        content.pipeline.performance[platform][0] = {
          ...content.pipeline.performance[platform][0],
          predictedEngagement: prediction.adjustedPrediction.engagement,
          predictedReach: prediction.adjustedPrediction.reach,
          updatedAt: new Date(),
          basedOn: prediction.basedOn,
          accuracy: prediction.accuracy
        };
      }
    }

    content.pipeline.lastUpdated = new Date();
    await content.save();

    logger.info('Predictions updated with new data', { userId, contentId });
    return updatedPredictions;
  } catch (error) {
    logger.error('Error updating predictions', { error: error.message, userId, contentId });
    throw error;
  }
}

module.exports = {
  getAdaptivePerformancePrediction,
  updatePredictionsWithNewData,
  generatePerformanceForecast,
  calculateROI
};


