// Hashtag Generator Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client for hashtags', { error: error.message });
      return null;
    }
  }
  return openai;
}

/**
 * Generate hashtags
 */
async function generateHashtags(contentText, options = {}) {
  try {
    const {
      platform = 'instagram',
      count = 20,
      includeTrending = true,
      includeNiche = true,
    } = options;

    const prompt = `Generate ${count} relevant hashtags for this content on ${platform}:

Content:
${contentText}

Requirements:
${includeTrending ? '- Include trending hashtags' : ''}
${includeNiche ? '- Include niche-specific hashtags' : ''}
- Mix of popular and less competitive tags
- Platform-appropriate format

Provide as JSON array with fields: hashtag, category (trending/niche/popular), estimatedReach (high/medium/low)`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate hashtags');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a hashtag strategist. Generate effective hashtags that maximize reach and engagement.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const hashtagsText = response.choices[0].message.content;
    
    let hashtags;
    try {
      hashtags = JSON.parse(hashtagsText);
    } catch (error) {
      const jsonMatch = hashtagsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        hashtags = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: extract hashtags from text
        hashtags = hashtagsText
          .match(/#\w+/g)
          ?.map(tag => ({
            hashtag: tag.replace('#', ''),
            category: 'general',
            estimatedReach: 'medium',
          })) || [];
      }
    }

    logger.info('Hashtags generated', { count: hashtags.length, platform });
    return hashtags;
  } catch (error) {
    logger.error('Generate hashtags error', { error: error.message });
    throw error;
  }
}

/**
 * Analyze hashtag performance
 */
async function analyzeHashtagPerformance(userId, hashtags = []) {
  try {
    const Content = require('../models/Content');
    
    // Get content with these hashtags
    const contentWithHashtags = await Content.find({
      userId,
      tags: { $in: hashtags },
      status: 'published',
    })
      .select('tags views likes shares')
      .lean();

    const performance = hashtags.map(hashtag => {
      const content = contentWithHashtags.filter(c => c.tags?.includes(hashtag));
      
      const totalViews = content.reduce((sum, c) => sum + (c.views || 0), 0);
      const totalLikes = content.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalShares = content.reduce((sum, c) => sum + (c.shares || 0), 0);
      const avgViews = content.length > 0 ? totalViews / content.length : 0;
      const avgLikes = content.length > 0 ? totalLikes / content.length : 0;
      const avgShares = content.length > 0 ? totalShares / content.length : 0;

      return {
        hashtag,
        usageCount: content.length,
        totalViews,
        totalLikes,
        totalShares,
        avgViews: Math.round(avgViews),
        avgLikes: Math.round(avgLikes),
        avgShares: Math.round(avgShares),
        performanceScore: calculatePerformanceScore(avgViews, avgLikes, avgShares),
      };
    });

    return performance.sort((a, b) => b.performanceScore - a.performanceScore);
  } catch (error) {
    logger.error('Analyze hashtag performance error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get trending hashtags
 */
async function getTrendingHashtags(platform, category = null) {
  try {
    const prompt = `Provide current trending hashtags for ${platform}${category ? ` in ${category} category` : ''}.

Include:
1. Top 10 trending hashtags
2. Emerging hashtags (growing fast)
3. Niche hashtags (specific to category)

Format as JSON object with fields: trending (array), emerging (array), niche (array)`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate hashtags');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a social media trend analyst. Provide accurate trending hashtag information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const trendsText = response.choices[0].message.content;
    
    let trends;
    try {
      trends = JSON.parse(trendsText);
    } catch (error) {
      const jsonMatch = trendsText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        trends = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse trends');
      }
    }

    logger.info('Trending hashtags fetched', { platform, category });
    return trends;
  } catch (error) {
    logger.error('Get trending hashtags error', { error: error.message, platform });
    throw error;
  }
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(views, likes, shares) {
  // Weighted score: views (40%), likes (40%), shares (20%)
  const normalizedViews = Math.min(views / 1000, 1) * 100;
  const normalizedLikes = Math.min(likes / 100, 1) * 100;
  const normalizedShares = Math.min(shares / 50, 1) * 100;
  
  return Math.round(
    normalizedViews * 0.4 +
    normalizedLikes * 0.4 +
    normalizedShares * 0.2
  );
}

module.exports = {
  generateHashtags,
  analyzeHashtagPerformance,
  getTrendingHashtags,
};






