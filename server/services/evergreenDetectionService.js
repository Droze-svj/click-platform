// Evergreen Detection Service
// Wrapper for evergreen content detection

const { detectEvergreenContent: advancedDetect } = require('./advancedEvergreenService');
const logger = require('../utils/logger');

/**
 * Detect evergreen content (simplified interface)
 */
async function detectEvergreenContent(content, options = {}) {
  try {
    const {
      minScore = 70,
      platform = null,
      userId = null
    } = options;

    // Use advanced evergreen detection if userId is provided
    if (userId && advancedDetect) {
      try {
        const result = await advancedDetect(userId, {
          contentId: content._id,
          platform
        });
        // Extract score from result
        if (result && result.length > 0) {
          const item = result.find(r => r.contentId.toString() === content._id.toString());
          if (item && item.avgScore) {
            return Math.round(item.avgScore * 100);
          }
        }
      } catch (error) {
        logger.warn('Advanced evergreen detection failed, using fallback', { error: error.message });
      }
    }

    // Fallback to simplified scoring
    return await calculateEvergreenScore(content, options);
  } catch (error) {
    logger.error('Error detecting evergreen content', { error: error.message, contentId: content._id });
    return 0;
  }
}

/**
 * Calculate evergreen score
 */
async function calculateEvergreenScore(content, options = {}) {
  try {
    let score = 0;

    // Timeless topics (40 points)
    const timelessKeywords = [
      'how to', 'guide', 'tutorial', 'tips', 'best practices',
      'fundamentals', 'basics', 'explained', 'overview', 'introduction'
    ];
    const contentText = (content.title || '') + ' ' + (content.content?.text || '') + ' ' + (content.description || '');
    const lowerText = contentText.toLowerCase();
    
    const timelessMatches = timelessKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += Math.min(timelessMatches * 5, 40);

    // Content age (20 points) - older content that still performs is more evergreen
    if (content.createdAt) {
      const ageInDays = (new Date() - new Date(content.createdAt)) / (1000 * 60 * 60 * 24);
      if (ageInDays > 90) {
        score += 20; // Old content that's still relevant
      } else if (ageInDays > 30) {
        score += 10;
      }
    }

    // Performance history (30 points)
    if (content.analytics) {
      const avgEngagement = content.analytics.averageEngagement || 0;
      if (avgEngagement > 100) score += 15;
      if (avgEngagement > 50) score += 10;
      if (avgEngagement > 20) score += 5;
    }

    // Content type (10 points)
    const evergreenTypes = ['article', 'guide', 'tutorial', 'how-to'];
    if (evergreenTypes.some(type => lowerText.includes(type))) {
      score += 10;
    }

    // No time-sensitive references (10 points)
    const timeSensitive = ['today', 'yesterday', 'this week', 'this month', '2024', '2023'];
    const hasTimeSensitive = timeSensitive.some(term => lowerText.includes(term));
    if (!hasTimeSensitive) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  } catch (error) {
    logger.error('Error calculating evergreen score', { error: error.message });
    return 0;
  }
}

module.exports = {
  detectEvergreenContent,
  calculateEvergreenScore
};

