// Content Template Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Generate content from template
 */
async function generateFromTemplate(templateType, variables = {}) {
  try {
    const templates = {
      'product-launch': {
        structure: ['Hook', 'Problem', 'Solution', 'Features', 'CTA'],
        tone: 'excited',
      },
      'educational': {
        structure: ['Title', 'Introduction', 'Main Points', 'Examples', 'Conclusion'],
        tone: 'informative',
      },
      'storytelling': {
        structure: ['Setup', 'Conflict', 'Resolution', 'Lesson', 'CTA'],
        tone: 'engaging',
      },
      'announcement': {
        structure: ['Headline', 'Details', 'Benefits', 'Timeline', 'CTA'],
        tone: 'professional',
      },
      'behind-scenes': {
        structure: ['Hook', 'Process', 'Challenges', 'Results', 'CTA'],
        tone: 'authentic',
      },
    };

    const template = templates[templateType] || templates['educational'];

    const prompt = `Generate content using the ${templateType} template structure:

Structure: ${template.structure.join(' → ')}
Tone: ${template.tone}
Variables: ${JSON.stringify(variables)}

For each section, provide:
1. Section name
2. Content text
3. Suggested length

Format as JSON object with sections array, each containing: name, content, suggestedLength`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate content from template');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content template expert. Generate structured content following templates.\n\n${prompt}`;
    const contentText = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 2000 });

    let content;
    try {
      content = JSON.parse(contentText);
    } catch (error) {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse template content');
      }
    }

    logger.info('Content generated from template', { templateType });
    return content;
  } catch (error) {
    logger.error('Generate from template error', { error: error.message, templateType });
    throw error;
  }
}

/**
 * Analyze competitor content
 */
async function analyzeCompetitorContent(competitorUrls = [], platform) {
  try {
    // In production, this would fetch actual competitor content
    // For now, provide analysis framework

    const prompt = `Analyze competitor content strategy for ${platform}:

Competitor URLs: ${competitorUrls.join(', ')}

Provide analysis:
1. Content themes and topics
2. Posting frequency patterns
3. Engagement strategies
4. Hashtag usage
5. Content formats
6. Best performing content types
7. Recommendations for differentiation

Format as JSON object with fields: themes (array), frequency, engagementStrategies (array), hashtagPatterns (array), formats (array), topPerformers (array), recommendations (array)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot analyze competitor content');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a competitive analysis expert. Analyze competitor content strategies.\n\n${prompt}`;
    const analysisText = await geminiGenerate(fullPrompt, { temperature: 0.5, maxTokens: 2000 });

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse competitor analysis');
      }
    }

    logger.info('Competitor content analyzed', { platform, count: competitorUrls.length });
    return analysis;
  } catch (error) {
    logger.error('Analyze competitor content error', { error: error.message });
    throw error;
  }
}

/**
 * Get seasonal trends
 */
async function getSeasonalTrends(season, category = null) {
  try {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;

    const seasonMap = {
      12: 'winter', 1: 'winter', 2: 'winter',
      3: 'spring', 4: 'spring', 5: 'spring',
      6: 'summer', 7: 'summer', 8: 'summer',
      9: 'fall', 10: 'fall', 11: 'fall',
    };

    const currentSeason = season || seasonMap[month];

    const prompt = `Provide seasonal content trends for ${currentSeason}${category ? ` in ${category} category` : ''}:

Include:
1. Trending topics
2. Seasonal hashtags
3. Content themes
4. Best posting times
5. Content format recommendations
6. Audience behavior insights

Format as JSON object with fields: trendingTopics (array), seasonalHashtags (array), themes (array), postingTimes (array), formatRecommendations (array), audienceInsights (object)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot fetch seasonal trends');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a seasonal trend analyst. Provide relevant seasonal content insights.\n\n${prompt}`;
    const trendsText = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 1500 });

    let trends;
    try {
      trends = JSON.parse(trendsText);
    } catch (error) {
      const jsonMatch = trendsText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        trends = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse seasonal trends');
      }
    }

    logger.info('Seasonal trends fetched', { season: currentSeason, category });
    return trends;
  } catch (error) {
    logger.error('Get seasonal trends error', { error: error.message, season });
    throw error;
  }
}

module.exports = {
  generateFromTemplate,
  analyzeCompetitorContent,
  getSeasonalTrends,
};






