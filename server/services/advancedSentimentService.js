// Advanced Sentiment Service
// AI-powered sentiment analysis with topic tracking

const CommentSentiment = require('../models/CommentSentiment');
const logger = require('../utils/logger');

/**
 * Advanced sentiment analysis with topic extraction
 */
async function analyzeAdvancedSentiment(text, options = {}) {
  try {
    const {
      extractTopics = true,
      detectEmotions = true
    } = options;

    // In production, would use OpenAI or similar for advanced analysis
    // For now, enhanced rule-based analysis

    const sentiment = await analyzeSentimentAdvanced(text);
    const topics = extractTopics ? extractTopicsFromText(text) : [];
    const emotions = detectEmotions ? detectEmotionsInText(text) : {};

    return {
      sentiment,
      topics,
      emotions,
      confidence: calculateConfidence(text, sentiment)
    };
  } catch (error) {
    logger.error('Error in advanced sentiment analysis', { error: error.message });
    throw error;
  }
}

/**
 * Advanced sentiment analysis
 */
async function analyzeSentimentAdvanced(text) {
  const positiveWords = [
    'great', 'amazing', 'love', 'best', 'excellent', 'wonderful', 'fantastic', 'awesome',
    'perfect', 'brilliant', 'outstanding', 'superb', 'incredible', 'phenomenal', 'stellar'
  ];
  const negativeWords = [
    'bad', 'terrible', 'hate', 'worst', 'awful', 'horrible', 'disappointing', 'poor',
    'disgusting', 'pathetic', 'useless', 'garbage', 'trash', 'sucks', 'hateful'
  ];
  const neutralWords = ['okay', 'fine', 'alright', 'average', 'decent'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  const neutralCount = neutralWords.filter(word => lowerText.includes(word)).length;

  // Check for intensifiers
  const intensifiers = ['very', 'extremely', 'really', 'so', 'super'];
  const hasIntensifier = intensifiers.some(word => lowerText.includes(word));
  const multiplier = hasIntensifier ? 1.5 : 1;

  let overall = 'neutral';
  if (positiveCount * multiplier > negativeCount) overall = 'positive';
  else if (negativeCount * multiplier > positiveCount) overall = 'negative';

  const total = positiveCount + negativeCount + neutralCount;
  const positive = total > 0 ? (positiveCount / total) * 100 * multiplier : 50;
  const negative = total > 0 ? (negativeCount / total) * 100 * multiplier : 0;
  const neutral = 100 - Math.min(100, positive) - Math.min(100, negative);

  return {
    overall,
    scores: {
      positive: Math.round(Math.min(100, positive)),
      neutral: Math.round(Math.max(0, neutral)),
      negative: Math.round(Math.min(100, negative))
    },
    confidence: Math.min(100, total * 15)
  };
}

/**
 * Extract topics from text
 */
function extractTopicsFromText(text) {
  // Common topic keywords (would use NLP in production)
  const topicKeywords = {
    product: ['product', 'feature', 'service', 'solution'],
    support: ['help', 'support', 'issue', 'problem', 'question'],
    pricing: ['price', 'cost', 'expensive', 'cheap', 'affordable'],
    quality: ['quality', 'good', 'bad', 'excellent', 'poor'],
    delivery: ['delivery', 'shipping', 'fast', 'slow']
  };

  const lowerText = text.toLowerCase();
  const topics = [];

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic);
    }
  });

  return topics;
}

/**
 * Detect emotions in text
 */
function detectEmotionsInText(text) {
  const emotions = {
    joy: ['happy', 'excited', 'joy', 'delighted', 'thrilled'],
    anger: ['angry', 'mad', 'furious', 'annoyed', 'frustrated'],
    sadness: ['sad', 'disappointed', 'upset', 'unhappy'],
    fear: ['worried', 'concerned', 'afraid', 'scared'],
    surprise: ['surprised', 'shocked', 'amazed', 'wow']
  };

  const lowerText = text.toLowerCase();
  const detected = {};

  Object.entries(emotions).forEach(([emotion, keywords]) => {
    const count = keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (count > 0) {
      detected[emotion] = count;
    }
  });

  return detected;
}

/**
 * Calculate confidence
 */
function calculateConfidence(text, sentiment) {
  // More words = higher confidence
  const wordCount = text.split(/\s+/).length;
  const baseConfidence = Math.min(100, wordCount * 5);
  
  // Strong sentiment = higher confidence
  const sentimentStrength = Math.max(
    sentiment.scores.positive,
    sentiment.scores.negative
  );

  return Math.round((baseConfidence + sentimentStrength) / 2);
}

/**
 * Get sentiment trends by topic
 */
async function getSentimentTrendsByTopic(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const query = { workspaceId };
    if (platform) query['comment.platform'] = platform;
    if (startDate || endDate) {
      query['comment.timestamp'] = {};
      if (startDate) query['comment.timestamp'].$gte = new Date(startDate);
      if (endDate) query['comment.timestamp'].$lte = new Date(endDate);
    }

    const comments = await CommentSentiment.find(query).lean();

    // Group by topic (would extract from comment text in production)
    const topicSentiment = {};

    comments.forEach(comment => {
      // Simplified topic extraction
      const topics = extractTopicsFromText(comment.comment.text);
      
      topics.forEach(topic => {
        if (!topicSentiment[topic]) {
          topicSentiment[topic] = {
            positive: 0,
            neutral: 0,
            negative: 0,
            total: 0
          };
        }

        topicSentiment[topic][comment.sentiment.overall]++;
        topicSentiment[topic].total++;
      });
    });

    // Calculate percentages
    Object.keys(topicSentiment).forEach(topic => {
      const data = topicSentiment[topic];
      data.positivePercentage = (data.positive / data.total) * 100;
      data.negativePercentage = (data.negative / data.total) * 100;
      data.neutralPercentage = (data.neutral / data.total) * 100;
    });

    return topicSentiment;
  } catch (error) {
    logger.error('Error getting sentiment trends by topic', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  analyzeAdvancedSentiment,
  getSentimentTrendsByTopic
};


