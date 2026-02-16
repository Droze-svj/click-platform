// AI Content Ideation Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

async function callGemini(systemPrompt, userPrompt, options = {}) {
  if (!geminiConfigured) {
    throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
  }
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return geminiGenerate(fullPrompt, { temperature: options.temperature ?? 0.7, maxTokens: options.maxTokens ?? 2000 });
}

/**
 * Generate content ideas
 */
async function generateContentIdeas(userId, options = {}) {
  try {
    const { topic = null, platform = 'general', count = 10, style = 'engaging', audience = 'general' } = options;

    const prompt = `Generate ${count} creative and engaging content ideas for ${platform} platform.
${topic ? `Topic: ${topic}` : 'General content ideas'}
Style: ${style}
Target audience: ${audience}

For each idea, provide:
1. A catchy title
2. A brief description
3. Suggested format (post, video, carousel, etc.)
4. Key points to cover
5. Potential hashtags

Format as JSON array with fields: title, description, format, keyPoints (array), hashtags (array). Return only the JSON array.`;

    const ideasText = await callGemini(
      'You are a creative content strategist. Generate innovative and engaging content ideas that resonate with audiences.',
      prompt,
      { temperature: 0.9, maxTokens: 2000 }
    );

    let ideas;
    try {
      ideas = JSON.parse(ideasText || '[]');
    } catch (error) {
      const jsonMatch = (ideasText || '').match(/\[[\s\S]*\]/);
      ideas = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    logger.info('Content ideas generated', { userId, count: ideas.length });
    return ideas;
  } catch (error) {
    logger.error('Generate content ideas error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Analyze trends
 */
async function analyzeTrends(platform, category = null) {
  try {
    const prompt = `Analyze current trends for ${platform} platform${category ? ` in ${category} category` : ''}.

Provide:
1. Top 5 trending topics
2. Emerging trends
3. Best posting times
4. Content formats performing well
5. Audience insights

Format as JSON with fields: trendingTopics (array), emergingTrends (array), bestPostingTimes (array), topFormats (array), audienceInsights (object). Return only valid JSON.`;

    const trendsText = await callGemini(
      'You are a social media trend analyst. Provide accurate and actionable trend insights.',
      prompt,
      { temperature: 0.7, maxTokens: 1500 }
    );

    let trends;
    try {
      trends = JSON.parse(trendsText || '{}');
    } catch (error) {
      const jsonMatch = (trendsText || '').match(/\{[\s\S]*\}/);
      trends = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    logger.info('Trends analyzed', { platform, category });
    return trends;
  } catch (error) {
    logger.error('Analyze trends error', { error: error.message, platform });
    throw error;
  }
}

/**
 * Brainstorm content variations
 */
async function brainstormVariations(contentId, userId) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({ _id: contentId, userId }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const prompt = `Create 5 creative variations of this content:

Title: ${content.title}
Body: ${content.body}

For each variation, provide:
1. A new angle or perspective
2. Different tone (professional, casual, humorous, etc.)
3. Alternative formats
4. Modified key points

Format as JSON array with fields: angle, tone, format, keyPoints (array), description. Return only the JSON array.`;

    const variationsText = await callGemini(
      'You are a creative content strategist. Generate innovative variations that maintain the core message while exploring new angles.',
      prompt,
      { temperature: 0.8, maxTokens: 2000 }
    );

    let variations;
    try {
      variations = JSON.parse(variationsText || '[]');
    } catch (error) {
      const jsonMatch = (variationsText || '').match(/\[[\s\S]*\]/);
      variations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    logger.info('Content variations generated', { contentId, userId, count: variations.length });
    return variations;
  } catch (error) {
    logger.error('Brainstorm variations error', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get content suggestions based on performance
 */
async function getPerformanceBasedSuggestions(userId, limit = 10) {
  try {
    const Content = require('../models/Content');

    const topContent = await Content.find({ userId, status: 'published' })
      .sort({ views: -1 })
      .limit(5)
      .select('title body tags')
      .lean();

    if (topContent.length === 0) {
      return { suggestions: [] };
    }

    const prompt = `Based on these top-performing content pieces, suggest ${limit} new content ideas that would likely perform well:

${topContent.map((c, i) => `${i + 1}. ${c.title}\n   ${c.body?.substring(0, 200) || ''}...\n   Tags: ${c.tags?.join(', ') || 'none'}`).join('\n\n')}

For each suggestion, provide:
1. Title
2. Description
3. Why it would perform well
4. Suggested tags

Format as JSON array with fields: title, description, reasoning, tags (array). Return only the JSON array.`;

    const suggestionsText = await callGemini(
      'You are a data-driven content strategist. Analyze successful content and suggest similar high-performing ideas.',
      prompt,
      { temperature: 0.7, maxTokens: 2000 }
    );

    let suggestions;
    try {
      const parsed = JSON.parse(suggestionsText || '[]');
      suggestions = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      const jsonMatch = (suggestionsText || '').match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    logger.info('Performance-based suggestions generated', { userId, count: suggestions.length });
    return { suggestions };
  } catch (error) {
    logger.error('Get performance suggestions error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  generateContentIdeas,
  analyzeTrends,
  brainstormVariations,
  getPerformanceBasedSuggestions,
};
