// Content Prediction Service
// Predict content performance before posting

const ContentPrediction = require('../models/ContentPrediction');
const ContentPerformance = require('../models/ContentPerformance');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Predict content performance
 */
async function predictContentPerformance(postId) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post) {
      throw new Error('Post not found');
    }

    // Get historical performance data for similar content
    const similarContent = await ContentPerformance.find({
      workspaceId: post.workspaceId,
      platform: post.platform,
      'content.format': detectFormat(post, post.contentId),
      'content.type': post.contentId?.type || 'post'
    })
      .sort({ 'scores.overall': -1 })
      .limit(10)
      .lean();

    // Calculate predictions based on historical data
    const predictions = calculatePredictions(similarContent, post);

    // Calculate factors
    const factors = calculateFactors(post, similarContent);

    // Create prediction
    const prediction = await ContentPrediction.findOneAndUpdate(
      { postId },
      {
        $set: {
          postId,
          contentId: post.contentId?._id,
          workspaceId: post.workspaceId,
          platform: post.platform,
          predictions,
          factors,
          predictedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Content performance predicted', { postId, predictedScore: predictions.overall.predicted });
    return prediction;
  } catch (error) {
    logger.error('Error predicting content performance', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate predictions
 */
function calculatePredictions(similarContent, post) {
  if (similarContent.length === 0) {
    // Default predictions if no similar content
    return {
      engagement: { predicted: 0, confidence: 30, range: { min: 0, max: 0 } },
      clicks: { predicted: 0, confidence: 30, range: { min: 0, max: 0 } },
      conversions: { predicted: 0, confidence: 30, range: { min: 0, max: 0 } },
      revenue: { predicted: 0, confidence: 30, range: { min: 0, max: 0 } },
      overall: { predicted: 50, confidence: 30, category: 'average' }
    };
  }

  // Calculate averages
  const avgEngagement = similarContent.reduce((sum, c) => sum + (c.performance.engagement || 0), 0) / similarContent.length;
  const avgClicks = similarContent.reduce((sum, c) => sum + (c.performance.clicks || 0), 0) / similarContent.length;
  const avgConversions = similarContent.reduce((sum, c) => sum + (c.performance.conversions || 0), 0) / similarContent.length;
  const avgRevenue = similarContent.reduce((sum, c) => sum + (c.performance.revenue || 0), 0) / similarContent.length;
  const avgScore = similarContent.reduce((sum, c) => sum + (c.scores.overall || 0), 0) / similarContent.length;

  // Calculate standard deviations for ranges
  const engagementStd = calculateStdDev(similarContent.map(c => c.performance.engagement || 0));
  const clicksStd = calculateStdDev(similarContent.map(c => c.performance.clicks || 0));
  const conversionsStd = calculateStdDev(similarContent.map(c => c.performance.conversions || 0));
  const revenueStd = calculateStdDev(similarContent.map(c => c.performance.revenue || 0));

  // Confidence based on sample size
  const confidence = Math.min(100, 50 + (similarContent.length * 5));

  // Determine category
  let category = 'average';
  if (avgScore >= 80) category = 'top_performer';
  else if (avgScore >= 60) category = 'high_performer';
  else if (avgScore >= 40) category = 'average';
  else if (avgScore >= 20) category = 'below_average';
  else category = 'low_performer';

  return {
    engagement: {
      predicted: Math.round(avgEngagement),
      confidence,
      range: {
        min: Math.max(0, Math.round(avgEngagement - engagementStd)),
        max: Math.round(avgEngagement + engagementStd)
      }
    },
    clicks: {
      predicted: Math.round(avgClicks),
      confidence,
      range: {
        min: Math.max(0, Math.round(avgClicks - clicksStd)),
        max: Math.round(avgClicks + clicksStd)
      }
    },
    conversions: {
      predicted: Math.round(avgConversions),
      confidence,
      range: {
        min: Math.max(0, Math.round(avgConversions - conversionsStd)),
        max: Math.round(avgConversions + conversionsStd)
      }
    },
    revenue: {
      predicted: Math.round(avgRevenue * 100) / 100,
      confidence,
      range: {
        min: Math.max(0, Math.round((avgRevenue - revenueStd) * 100) / 100),
        max: Math.round((avgRevenue + revenueStd) * 100) / 100
      }
    },
    overall: {
      predicted: Math.round(avgScore),
      confidence,
      category
    }
  };
}

/**
 * Calculate factors
 */
function calculateFactors(post, similarContent) {
  return {
    contentQuality: 70, // Would analyze actual content quality
    timing: 60, // Would analyze optimal timing
    format: 75, // Based on format performance
    topic: 65, // Based on topic performance
    historicalPerformance: similarContent.length > 0 ? 80 : 40
  };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Update prediction with actual performance
 */
async function updatePredictionWithActual(postId) {
  try {
    const prediction = await ContentPrediction.findOne({ postId }).lean();
    if (!prediction) {
      return null;
    }

    const performance = await ContentPerformance.findOne({ postId }).lean();
    if (!performance) {
      return null;
    }

    const actual = {
      engagement: performance.performance.engagement || 0,
      clicks: performance.performance.clicks || 0,
      conversions: performance.performance.conversions || 0,
      revenue: performance.performance.revenue || 0,
      accuracy: calculateAccuracy(prediction.predictions, actual)
    };

    await ContentPrediction.findByIdAndUpdate(prediction._id, {
      $set: { actual }
    });

    return { ...prediction, actual };
  } catch (error) {
    logger.error('Error updating prediction with actual', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate prediction accuracy
 */
function calculateAccuracy(predictions, actual) {
  const metrics = ['engagement', 'clicks', 'conversions', 'revenue'];
  let totalAccuracy = 0;
  let count = 0;

  metrics.forEach(metric => {
    const predicted = predictions[metric]?.predicted || 0;
    const actualValue = actual[metric] || 0;
    
    if (predicted > 0 || actualValue > 0) {
      const error = Math.abs(predicted - actualValue);
      const maxValue = Math.max(predicted, actualValue);
      const accuracy = maxValue > 0 ? (1 - (error / maxValue)) * 100 : 0;
      totalAccuracy += accuracy;
      count++;
    }
  });

  return count > 0 ? Math.round(totalAccuracy / count) : 0;
}

/**
 * Detect format
 */
function detectFormat(post, content) {
  if (content?.type === 'video') return 'video';
  if (post.content?.mediaUrl) return 'image';
  if (post.content?.text && post.content?.mediaUrl) return 'link';
  return 'text';
}

module.exports = {
  predictContentPerformance,
  updatePredictionWithActual
};


