// Hashtag Generator Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

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

Provide as JSON array with fields: hashtag, category (trending/niche/popular), estimatedReach (high/medium/low). Return only the JSON array.`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate hashtags');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a hashtag strategist. Generate effective hashtags that maximize reach and engagement.\n\n${prompt}`;
    const hashtagsText = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 1000 });

    let hashtags;
    try {
      hashtags = JSON.parse(hashtagsText || '[]');
    } catch (error) {
      const jsonMatch = (hashtagsText || '').match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        hashtags = JSON.parse(jsonMatch[0]);
      } else {
        hashtags = (hashtagsText || '')
          .match(/#\w+/g)
          ?.map((tag) => ({
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

    const contentWithHashtags = await Content.find({
      userId,
      tags: { $in: hashtags },
      status: 'published',
    })
      .select('tags views likes shares')
      .lean();

    const performance = hashtags.map((hashtag) => {
      const content = contentWithHashtags.filter((c) => c.tags?.includes(hashtag));

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

Format as JSON object with fields: trending (array), emerging (array), niche (array). Return only valid JSON.`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate hashtags');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a social media trend analyst. Provide accurate trending hashtag information.\n\n${prompt}`;
    const trendsText = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 800 });

    let trends;
    try {
      trends = JSON.parse(trendsText || '{}');
    } catch (error) {
      const jsonMatch = (trendsText || '').match(/\{[\s\S]*\}/);
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

function calculatePerformanceScore(views, likes, shares) {
  const normalizedViews = Math.min(views / 1000, 1) * 100;
  const normalizedLikes = Math.min(likes / 100, 1) * 100;
  const normalizedShares = Math.min(shares / 50, 1) * 100;

  return Math.round(
    normalizedViews * 0.4 + normalizedLikes * 0.4 + normalizedShares * 0.2
  );
}

module.exports = {
  generateHashtags,
  analyzeHashtagPerformance,
  getTrendingHashtags,
};
