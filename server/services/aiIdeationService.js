// AI Content Ideation Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate content ideas
 */
async function generateContentIdeas(userId, options = {}) {
  try {
    const {
      topic = null,
      platform = 'general',
      count = 10,
      style = 'engaging',
      audience = 'general',
    } = options;

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

Format as JSON array with fields: title, description, format, keyPoints (array), hashtags (array)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a creative content strategist. Generate innovative and engaging content ideas that resonate with audiences.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9,
      max_tokens: 2000,
    });

    const ideasText = response.choices[0].message.content;
    
    // Parse JSON from response
    let ideas;
    try {
      ideas = JSON.parse(ideasText);
    } catch (error) {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = ideasText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ideas = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse ideas');
      }
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

Format as JSON with fields: trendingTopics (array), emergingTrends (array), bestPostingTimes (array), topFormats (array), audienceInsights (object)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a social media trend analyst. Provide accurate and actionable trend insights.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
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

Format as JSON array with fields: angle, tone, format, keyPoints (array), description`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a creative content strategist. Generate innovative variations that maintain the core message while exploring new angles.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const variationsText = response.choices[0].message.content;
    
    let variations;
    try {
      variations = JSON.parse(variationsText);
    } catch (error) {
      const jsonMatch = variationsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse variations');
      }
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
    
    // Get top performing content
    const topContent = await Content.find({ userId, status: 'published' })
      .sort({ views: -1 })
      .limit(5)
      .select('title body tags')
      .lean();

    if (topContent.length === 0) {
      return { suggestions: [] };
    }

    const prompt = `Based on these top-performing content pieces, suggest ${limit} new content ideas that would likely perform well:

${topContent.map((c, i) => `${i + 1}. ${c.title}\n   ${c.body.substring(0, 200)}...\n   Tags: ${c.tags?.join(', ') || 'none'}`).join('\n\n')}

For each suggestion, provide:
1. Title
2. Description
3. Why it would perform well
4. Suggested tags

Format as JSON array with fields: title, description, reasoning, tags (array)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a data-driven content strategist. Analyze successful content and suggest similar high-performing ideas.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const suggestionsText = response.choices[0].message.content;
    
    let suggestions;
    try {
      suggestions = JSON.parse(suggestionsText);
    } catch (error) {
      const jsonMatch = suggestionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse suggestions');
      }
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






