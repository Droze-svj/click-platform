// Performance Preview Service
// Predict post performance for calendar

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const logger = require('../utils/logger');

// Optional: Try to load prediction service, fallback if not available
let predictContentPerformance = null;
try {
  const predictionService = require('./contentPerformancePredictionService');
  predictContentPerformance = predictionService.predictContentPerformance;
} catch (error) {
  logger.warn('Content performance prediction service not available', { error: error.message });
  // Fallback function
  predictContentPerformance = async () => null;
}

/**
 * Get performance preview for scheduled post
 */
async function getPerformancePreview(postId) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post) {
      throw new Error('Post not found');
    }

    // Get historical performance data for similar posts
    const similarPosts = await ScheduledPost.find({
      userId: post.userId,
      platform: post.platform,
      status: 'posted',
      scheduledTime: { $lt: new Date() }
    })
      .limit(10)
      .sort({ scheduledTime: -1 })
      .lean();

    // Calculate average performance
    const avgEngagement = similarPosts.length > 0
      ? similarPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / similarPosts.length
      : 0;

    const avgReach = similarPosts.length > 0
      ? similarPosts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0) / similarPosts.length
      : 0;

    // Use AI prediction if available
    let prediction = null;
    try {
      if (post.contentId) {
        const content = await Content.findById(post.contentId).lean();
        if (content) {
          prediction = await predictContentPerformance({
            content: content.content?.text || '',
            platform: post.platform,
            scheduledTime: post.scheduledTime,
            hashtags: post.content?.hashtags || []
          });
        }
      }
    } catch (error) {
      logger.warn('Error getting AI prediction', { error: error.message });
    }

    // Calculate factors
    const factors = [];
    
    // Time factor
    const hour = new Date(post.scheduledTime).getHours();
    if (hour >= 9 && hour <= 11) {
      factors.push('optimal_morning_time');
    } else if (hour >= 13 && hour <= 15) {
      factors.push('optimal_afternoon_time');
    } else if (hour >= 18 && hour <= 20) {
      factors.push('optimal_evening_time');
    }

    // Hashtag factor
    if (post.content?.hashtags && post.content.hashtags.length >= 3) {
      factors.push('good_hashtag_count');
    }

    // Content length factor
    const textLength = post.content?.text?.length || 0;
    if (textLength > 100 && textLength < 280) {
      factors.push('optimal_content_length');
    }

    // Confidence calculation
    let confidence = 'medium';
    if (prediction && similarPosts.length >= 5) {
      confidence = 'high';
    } else if (similarPosts.length >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      predictedEngagement: prediction?.engagement || Math.round(avgEngagement * 1.1),
      predictedReach: prediction?.reach || Math.round(avgReach * 1.1),
      predictedClicks: prediction?.clicks || Math.round(avgEngagement * 0.1),
      confidence,
      factors,
      basedOn: {
        similarPosts: similarPosts.length,
        hasPrediction: !!prediction
      },
      lastCalculated: new Date()
    };
  } catch (error) {
    logger.error('Error getting performance preview', { error: error.message, postId });
    throw error;
  }
}

/**
 * Batch get performance previews
 */
async function batchGetPerformancePreviews(postIds) {
  try {
    const previews = [];

    for (const postId of postIds) {
      try {
        const preview = await getPerformancePreview(postId);
        previews.push({
          postId,
          ...preview
        });
      } catch (error) {
        logger.warn('Error getting preview for post', { error: error.message, postId });
        previews.push({
          postId,
          error: error.message
        });
      }
    }

    return previews;
  } catch (error) {
    logger.error('Error batch getting performance previews', { error: error.message });
    throw error;
  }
}

module.exports = {
  getPerformancePreview,
  batchGetPerformancePreviews
};

