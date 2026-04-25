// Engagement Quality Service
// Score engagement quality and analyze sentiment

const EngagementQuality = require('../models/EngagementQuality');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Analyze engagement quality for a post
 */
async function analyzeEngagementQuality(postId) {
  try {
    const post = await ScheduledPost.findById(postId).lean();
    if (!post || !post.analytics) {
      throw new Error('Post not found or no analytics');
    }

    const analytics = post.analytics;
    const breakdown = analytics.engagementBreakdown || {};

    // Calculate quality factors
    const factors = {
      engagementDepth: calculateEngagementDepth(breakdown),
      engagementVelocity: calculateEngagementVelocity(post),
      engagementDiversity: calculateEngagementDiversity(breakdown),
      audienceQuality: 50, // Placeholder - would analyze engager profiles
      sentiment: await analyzeSentiment(post) // Would use AI sentiment analysis
    };

    // Calculate overall quality score
    const qualityScore = Math.round(
      factors.engagementDepth * 0.3 +
      factors.engagementVelocity * 0.2 +
      factors.engagementDiversity * 0.2 +
      factors.audienceQuality * 0.15 +
      factors.sentiment * 0.15
    );

    // Get sentiment analysis
    const sentimentAnalysis = await getSentimentAnalysis(post);

    // Create or update quality record
    const quality = await EngagementQuality.findOneAndUpdate(
      { postId },
      {
        $set: {
          qualityScore,
          factors,
          sentimentAnalysis,
          analyzedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    logger.info('Engagement quality analyzed', { postId, qualityScore });
    return quality;
  } catch (error) {
    logger.error('Error analyzing engagement quality', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate engagement depth
 * Comments and shares are weighted higher than likes
 */
function calculateEngagementDepth(breakdown) {
  const likes = breakdown.likes || 0;
  const comments = breakdown.comments || 0;
  const shares = breakdown.shares || 0;
  const total = likes + comments + shares;

  if (total === 0) return 0;

  // Weighted score: likes = 1, comments = 3, shares = 2
  const weightedEngagement = likes + (comments * 3) + (shares * 2);
  const maxPossible = total * 3; // If all were comments

  return (weightedEngagement / maxPossible) * 100;
}

/**
 * Calculate engagement velocity
 * How quickly engagement happened after posting
 */
function calculateEngagementVelocity(post) {
  if (!post.postedAt || !post.analytics?.lastUpdated) {
    return 50; // Default if no timing data
  }

  const hoursSincePost = (post.analytics.lastUpdated - post.postedAt) / (1000 * 60 * 60);
  const engagement = post.analytics.engagement || 0;

  if (hoursSincePost === 0) return 100;

  // Higher score for more engagement in less time
  const engagementPerHour = engagement / hoursSincePost;
  
  // Score based on engagement velocity (higher is better)
  // 100+ engagement/hour = 100, scales down
  return Math.min(100, (engagementPerHour / 10) * 100);
}

/**
 * Calculate engagement diversity
 * Variety of engagement types
 */
function calculateEngagementDiversity(breakdown) {
  const types = [
    breakdown.likes > 0,
    breakdown.comments > 0,
    breakdown.shares > 0,
    breakdown.saves > 0,
    breakdown.clicks > 0,
    breakdown.reactions > 0,
    breakdown.retweets > 0
  ].filter(Boolean).length;

  // Score based on number of engagement types
  return (types / 7) * 100;
}

/**
 * Analyze sentiment
 * Placeholder - would use AI sentiment analysis
 */
async function analyzeSentiment(post) {
  try {
    // In production, would use OpenAI or similar for sentiment analysis
    // For now, return a default score
    const hasComments = (post.analytics?.engagementBreakdown?.comments || 0) > 0;
    
    // Simple heuristic: more comments = potentially more discussion = higher sentiment score
    // In production, would analyze actual comment text
    return hasComments ? 70 : 60;
  } catch (error) {
    return 50; // Default
  }
}

/**
 * Get sentiment analysis
 */
async function getSentimentAnalysis(post) {
  // Placeholder - would analyze comments for sentiment
  // In production, would use AI to analyze comment text
  return {
    positive: 60,
    neutral: 30,
    negative: 10,
    overall: 'positive'
  };
}

/**
 * Get top performing content by quality
 */
async function getTopQualityContent(workspaceId, filters = {}) {
  try {
    const {
      platform = null,
      limit = 10,
      minScore = 70
    } = filters;

    // Get posts with quality scores
    const posts = await ScheduledPost.find({
      workspaceId,
      status: 'posted',
      ...(platform ? { platform } : {})
    })
      .populate('contentId')
      .lean();

    const qualityScores = await Promise.all(
      posts.map(async post => {
        try {
          const quality = await EngagementQuality.findOne({ postId: post._id }).lean();
          return {
            post,
            quality: quality || await analyzeEngagementQuality(post._id)
          };
        } catch (error) {
          return null;
        }
      })
    );

    const filtered = qualityScores
      .filter(item => item && item.quality.qualityScore >= minScore)
      .sort((a, b) => b.quality.qualityScore - a.quality.qualityScore)
      .slice(0, limit);

    return filtered;
  } catch (error) {
    logger.error('Error getting top quality content', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  analyzeEngagementQuality,
  getTopQualityContent
};


