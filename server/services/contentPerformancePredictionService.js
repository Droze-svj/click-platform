// Content performance prediction (optional).
// Connected to the active ML predictionService in V3.

const crypto = require('crypto');
const logger = require('../utils/logger');
const predictionService = require('./predictionService');

/**
 * Predict content performance (engagement, reach, etc.).
 * @param {Object} opts - { content, platform, scheduledTime, hashtags, userId }
 * @returns {Promise<Object|null>} Prediction or null
 */
async function predictContentPerformance(opts) {
  try {
    const text = opts?.content || '';
    const contentId = crypto.createHash('md5').update(text).digest('hex');

    logger.debug('Content performance prediction delegating to ML service', {
      platform: opts?.platform,
      hasContent: !!text
    });

    const contentData = {
      userId: opts?.userId || 'system',
      type: opts?.platform || 'text',
      title: text.substring(0, 50),
      description: text,
      category: 'general',
      tags: opts?.hashtags || [],
      scheduledTime: opts?.scheduledTime
    };

    const mlPrediction = await predictionService.predictContentPerformance(contentId, contentData);

    if (mlPrediction) {
      const engagementVal = typeof mlPrediction.estimatedEngagement === 'number'
        ? mlPrediction.estimatedEngagement
        : mlPrediction.estimatedEngagement?.expected || 0;

      const reachVal = typeof mlPrediction.estimatedReach === 'number'
        ? mlPrediction.estimatedReach
        : mlPrediction.estimatedReach?.expected || 0;

      return {
        engagement: engagementVal,
        reach: reachVal,
        clicks: Math.round(engagementVal * 0.12),
        score: mlPrediction.performanceScore || 0,
        factors: mlPrediction.spectralResonance ? ['spectral_resonance_detected'] : []
      };
    }
    return null;
  } catch (err) {
    logger.warn('Content performance prediction delegation error', { error: err.message });
    return null;
  }
}

module.exports = {
  predictContentPerformance
};

