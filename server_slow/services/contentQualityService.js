// Content Quality Service
// Score content quality and analyze sentiment

const ContentPerformance = require('../models/ContentPerformance');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Score content quality
 */
async function scoreContentQuality(postId) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post) {
      throw new Error('Post not found');
    }

    const content = post.contentId || {};
    const postContent = post.content || {};

    // Calculate quality factors
    const factors = {
      textQuality: scoreTextQuality(postContent.text || ''),
      mediaQuality: scoreMediaQuality(post, content),
      hashtagQuality: scoreHashtagQuality(postContent.hashtags || []),
      engagementQuality: scoreEngagementQuality(post),
      completeness: scoreCompleteness(post, content)
    };

    // Calculate overall quality score
    const qualityScore = Math.round(
      factors.textQuality * 0.25 +
      factors.mediaQuality * 0.20 +
      factors.hashtagQuality * 0.15 +
      factors.engagementQuality * 0.20 +
      factors.completeness * 0.20
    );

    // Analyze sentiment
    const sentiment = await analyzeSentiment(postContent.text || '');

    // Update content performance
    await ContentPerformance.findOneAndUpdate(
      { postId },
      {
        $set: {
          'metadata.qualityScore': qualityScore,
          'metadata.qualityFactors': factors,
          'metadata.sentiment': sentiment
        }
      },
      { upsert: true }
    );

    return {
      qualityScore,
      factors,
      sentiment,
      recommendations: generateQualityRecommendations(factors, qualityScore)
    };
  } catch (error) {
    logger.error('Error scoring content quality', { error: error.message, postId });
    throw error;
  }
}

/**
 * Score text quality
 */
function scoreTextQuality(text) {
  if (!text || text.length === 0) return 0;

  let score = 50; // Base score

  // Length check (optimal: 100-300 characters)
  if (text.length >= 100 && text.length <= 300) score += 20;
  else if (text.length >= 50 && text.length < 100) score += 10;
  else if (text.length > 300) score += 5;

  // Has questions (encourages engagement)
  if (text.includes('?')) score += 10;

  // Has call-to-action
  const ctaWords = ['click', 'learn', 'discover', 'try', 'get', 'buy', 'sign up'];
  if (ctaWords.some(word => text.toLowerCase().includes(word))) score += 10;

  // No excessive capitalization
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio < 0.2) score += 10;

  return Math.min(100, score);
}

/**
 * Score media quality
 */
function scoreMediaQuality(post, content) {
  let score = 0;

  if (post.content?.mediaUrl || content.originalFile?.url) {
    score += 50; // Has media

    // Video content gets bonus
    if (content.type === 'video') score += 20;

    // Multiple media (carousel)
    if (Array.isArray(post.content?.mediaUrl)) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Score hashtag quality
 */
function scoreHashtagQuality(hashtags) {
  if (!hashtags || hashtags.length === 0) return 0;

  let score = 0;

  // Optimal: 3-5 hashtags
  if (hashtags.length >= 3 && hashtags.length <= 5) score = 80;
  else if (hashtags.length >= 1 && hashtags.length < 3) score = 60;
  else if (hashtags.length > 5 && hashtags.length <= 10) score = 50;
  else score = 30; // Too many hashtags

  return score;
}

/**
 * Score engagement quality
 */
function scoreEngagementQuality(post) {
  const analytics = post.analytics || {};
  const engagement = analytics.engagement || 0;
  const reach = analytics.reach || 0;
  const impressions = analytics.impressions || 0;

  if (reach > 0) {
    const rate = (engagement / reach) * 100;
    return Math.min(100, (rate / 5) * 100); // 5% = 100 score
  } else if (impressions > 0) {
    const rate = (engagement / impressions) * 100;
    return Math.min(100, (rate / 3) * 100); // 3% = 100 score
  }

  return 0;
}

/**
 * Score completeness
 */
function scoreCompleteness(post, content) {
  let score = 0;

  if (post.content?.text) score += 25;
  if (post.content?.mediaUrl || content.originalFile?.url) score += 25;
  if (post.content?.hashtags && post.content.hashtags.length > 0) score += 25;
  if (post.scheduledTime) score += 25;

  return score;
}

/**
 * Analyze sentiment
 */
async function analyzeSentiment(text) {
  // Simplified sentiment analysis
  // In production, would use NLP library or AI service
  
  if (!text || text.length === 0) {
    return {
      overall: 'neutral',
      positive: 0,
      neutral: 100,
      negative: 0
    };
  }

  const positiveWords = ['great', 'amazing', 'love', 'best', 'excellent', 'wonderful', 'fantastic', 'awesome'];
  const negativeWords = ['bad', 'terrible', 'hate', 'worst', 'awful', 'horrible', 'disappointing'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

  let overall = 'neutral';
  if (positiveCount > negativeCount) overall = 'positive';
  else if (negativeCount > positiveCount) overall = 'negative';

  const total = positiveCount + negativeCount;
  const positive = total > 0 ? (positiveCount / total) * 100 : 0;
  const negative = total > 0 ? (negativeCount / total) * 100 : 0;
  const neutral = 100 - positive - negative;

  return {
    overall,
    positive: Math.round(positive),
    neutral: Math.round(neutral),
    negative: Math.round(negative)
  };
}

/**
 * Generate quality recommendations
 */
function generateQualityRecommendations(factors, qualityScore) {
  const recommendations = [];

  if (factors.textQuality < 60) {
    recommendations.push({
      factor: 'text',
      issue: 'Text quality is below optimal',
      suggestion: 'Improve text length, add questions or CTAs, reduce excessive capitalization'
    });
  }

  if (factors.mediaQuality < 50) {
    recommendations.push({
      factor: 'media',
      issue: 'Missing or low-quality media',
      suggestion: 'Add high-quality images or videos to improve engagement'
    });
  }

  if (factors.hashtagQuality < 60) {
    recommendations.push({
      factor: 'hashtags',
      issue: 'Hashtag usage is suboptimal',
      suggestion: 'Use 3-5 relevant hashtags for best results'
    });
  }

  if (qualityScore < 70) {
    recommendations.push({
      factor: 'overall',
      issue: 'Overall quality score is below average',
      suggestion: 'Review and improve multiple quality factors'
    });
  }

  return recommendations;
}

module.exports = {
  scoreContentQuality
};


