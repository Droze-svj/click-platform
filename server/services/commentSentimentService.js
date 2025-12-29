// Comment Sentiment Service
// Analyze comment sentiment and quality

const CommentSentiment = require('../models/CommentSentiment');
const logger = require('../utils/logger');

/**
 * Analyze comment sentiment
 */
async function analyzeCommentSentiment(postId, commentData) {
  try {
    const {
      commentId,
      text,
      author,
      timestamp,
      platform,
      engagement = {}
    } = commentData;

    // Analyze sentiment
    const sentiment = await analyzeSentiment(text);

    // Assess quality
    const quality = assessCommentQuality(text, author, engagement);

    // Create or update comment sentiment
    const commentSentiment = await CommentSentiment.findOneAndUpdate(
      { 'comment.id': commentId, postId },
      {
        $set: {
          postId,
          comment: {
            id: commentId,
            text,
            author: {
              id: author?.id,
              username: author?.username,
              followers: author?.followers || 0,
              verified: author?.verified || false
            },
            timestamp: new Date(timestamp),
            platform
          },
          sentiment,
          quality,
          engagement: {
            likes: engagement.likes || 0,
            replies: engagement.replies || 0,
            isPinned: engagement.isPinned || false,
            isAuthorReply: engagement.isAuthorReply || false
          },
          analyzedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Comment sentiment analyzed', { postId, commentId, sentiment: sentiment.overall, quality: quality.score });
    return commentSentiment;
  } catch (error) {
    logger.error('Error analyzing comment sentiment', { error: error.message, postId });
    throw error;
  }
}

/**
 * Analyze sentiment
 */
async function analyzeSentiment(text) {
  // Simplified sentiment analysis
  // In production, would use NLP library or AI service

  const positiveWords = ['great', 'amazing', 'love', 'best', 'excellent', 'wonderful', 'fantastic', 'awesome', 'perfect', 'brilliant'];
  const negativeWords = ['bad', 'terrible', 'hate', 'worst', 'awful', 'horrible', 'disappointing', 'poor', 'disgusting', 'pathetic'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

  let overall = 'neutral';
  if (positiveCount > negativeCount) overall = 'positive';
  else if (negativeCount > positiveCount) overall = 'negative';

  const total = positiveCount + negativeCount;
  const positive = total > 0 ? (positiveCount / total) * 100 : 50;
  const negative = total > 0 ? (negativeCount / total) * 100 : 0;
  const neutral = 100 - positive - negative;

  // Confidence based on word matches
  const confidence = total > 0 ? Math.min(100, total * 20) : 50;

  return {
    overall,
    scores: {
      positive: Math.round(positive),
      neutral: Math.round(neutral),
      negative: Math.round(negative)
    },
    confidence
  };
}

/**
 * Assess comment quality
 */
function assessCommentQuality(text, author, engagement) {
  let score = 50; // Base score

  // Length check (optimal: 20-200 characters)
  if (text.length >= 20 && text.length <= 200) score += 20;
  else if (text.length >= 10 && text.length < 20) score += 10;
  else if (text.length > 200) score += 5;

  // Author credibility
  if (author?.verified) score += 15;
  if (author?.followers) {
    if (author.followers >= 10000) score += 10;
    else if (author.followers >= 1000) score += 5;
  }

  // Engagement
  if (engagement.likes > 10) score += 10;
  if (engagement.replies > 5) score += 10;
  if (engagement.isPinned) score += 5;

  // Relevance (would use NLP in production)
  // For now, check for question marks (shows engagement)
  if (text.includes('?')) score += 5;

  // Determine category
  let category = 'medium_quality';
  if (score >= 80) category = 'high_quality';
  else if (score >= 60) category = 'medium_quality';
  else if (score >= 40) category = 'low_quality';
  else category = 'spam';

  return {
    score: Math.min(100, score),
    factors: {
      length: text.length >= 20 && text.length <= 200 ? 100 : 50,
      relevance: 70, // Placeholder
      engagement: engagement.likes > 0 ? 80 : 50,
      authorCredibility: author?.verified ? 90 : (author?.followers > 1000 ? 70 : 50)
    },
    category
  };
}

/**
 * Get comment sentiment trends
 */
async function getCommentSentimentTrends(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null,
      postId = null
    } = filters;

    const query = { workspaceId };
    if (platform) query['comment.platform'] = platform;
    if (postId) query.postId = postId;
    if (startDate || endDate) {
      query['comment.timestamp'] = {};
      if (startDate) query['comment.timestamp'].$gte = new Date(startDate);
      if (endDate) query['comment.timestamp'].$lte = new Date(endDate);
    }

    const comments = await CommentSentiment.find(query)
      .sort({ 'comment.timestamp': 1 })
      .lean();

    const trends = {
      positive: [],
      neutral: [],
      negative: [],
      quality: [],
      byPlatform: {},
      byQuality: {
        high_quality: 0,
        medium_quality: 0,
        low_quality: 0,
        spam: 0
      }
    };

    comments.forEach(comment => {
      // Sentiment trends
      trends.positive.push({
        date: comment.comment.timestamp,
        count: comment.sentiment.overall === 'positive' ? 1 : 0
      });
      trends.neutral.push({
        date: comment.comment.timestamp,
        count: comment.sentiment.overall === 'neutral' ? 1 : 0
      });
      trends.negative.push({
        date: comment.comment.timestamp,
        count: comment.sentiment.overall === 'negative' ? 1 : 0
      });

      // Quality trends
      trends.quality.push({
        date: comment.comment.timestamp,
        score: comment.quality.score
      });

      // By platform
      const platform = comment.comment.platform;
      if (!trends.byPlatform[platform]) {
        trends.byPlatform[platform] = {
          positive: 0,
          neutral: 0,
          negative: 0,
          total: 0
        };
      }
      trends.byPlatform[platform][comment.sentiment.overall]++;
      trends.byPlatform[platform].total++;

      // By quality
      trends.byQuality[comment.quality.category]++;
    });

    // Calculate summary
    const total = comments.length;
    const summary = {
      total,
      positive: comments.filter(c => c.sentiment.overall === 'positive').length,
      neutral: comments.filter(c => c.sentiment.overall === 'neutral').length,
      negative: comments.filter(c => c.sentiment.overall === 'negative').length,
      averageQuality: total > 0
        ? comments.reduce((sum, c) => sum + c.quality.score, 0) / total
        : 0,
      positiveTrend: calculateTrend(trends.positive),
      negativeTrend: calculateTrend(trends.negative)
    };

    return {
      trends,
      summary
    };
  } catch (error) {
    logger.error('Error getting comment sentiment trends', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Calculate trend
 */
function calculateTrend(data) {
  if (data.length < 2) return 0;

  const first = data[0].count;
  const last = data[data.length - 1].count;

  if (first === 0) return last > 0 ? 100 : 0;
  return ((last - first) / first) * 100;
}

module.exports = {
  analyzeCommentSentiment,
  getCommentSentimentTrends
};


