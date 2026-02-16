// AI Recommendations Engine

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const Content = require('../models/Content');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  AppError,
  NotFoundError,
  ServiceUnavailableError,
  recoveryStrategies,
} = require('../utils/errorHandler');

/**
 * Get personalized content recommendations
 */
async function getPersonalizedRecommendations(userId, options = {}) {
  try {
    const {
      limit = 10,
      type = null,
      platform = null,
    } = options;

    // Handle dev users - return empty array to avoid MongoDB CastErrors
    if (userId && (userId.toString().startsWith('dev-') || userId.toString().startsWith('test-') || userId.toString() === 'dev-user-123')) {
      logger.info('Returning empty recommendations for dev user');
      return {
        recommendations: [],
        insights: {},
        topPlatforms: []
      };
    }

    // Get user's content history - wrap in try-catch to handle CastErrors
    let userContent = [];
    let user = null;

    try {
      userContent = await Content.find({
        userId,
        status: 'published',
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title body tags category platform views likes')
        .lean();

      // Get user profile
      user = await User.findById(userId).select('name email preferences').lean();
    } catch (dbError) {
      // If it's a CastError, return empty recommendations
      if (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId')) {
        logger.warn('CastError in getPersonalizedRecommendations, returning empty recommendations', { error: dbError.message, userId });
        return {
          recommendations: [],
          insights: {},
          topPlatforms: []
        };
      }
      throw dbError;
    }

    // Analyze user preferences
    const preferences = analyzeUserPreferences(userContent);

    // Generate recommendations
    const prompt = `Generate personalized content recommendations for this user:

User Profile:
- Name: ${user?.name || 'User'}
- Content History: ${userContent.length} published items
- Preferred Categories: ${preferences.categories.join(', ') || 'General'}
- Preferred Platforms: ${preferences.platforms.join(', ') || 'General'}
- Top Performing Content: ${preferences.topTopics.join(', ') || 'N/A'}

Generate ${limit} content recommendations that:
1. Match user's interests
2. Build on successful content
3. Explore new angles
4. Are platform-appropriate
${type ? `5. Are of type: ${type}` : ''}
${platform ? `6. For platform: ${platform}` : ''}

For each recommendation, provide:
- Title
- Description
- Suggested platform
- Why it would perform well
- Key points to cover

Format as JSON array with fields: title, description, platform, reasoning, keyPoints (array). Return only the JSON array.`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate recommendations');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content recommendation engine. Provide personalized, data-driven recommendations.\n\n${prompt}`;
    const recommendationsText = await geminiGenerate(fullPrompt, { maxTokens: 2000, temperature: 0.7 });
    if (!recommendationsText) {
      throw new Error('No response from AI recommendations');
    }

    let recommendations;
    try {
      recommendations = JSON.parse(recommendationsText);
    } catch (error) {
      const jsonMatch = recommendationsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse recommendations');
      }
    }

    logger.info('Personalized recommendations generated', { userId, count: recommendations.length });
    return {
      recommendations,
      preferences,
      basedOn: {
        contentAnalyzed: userContent.length,
        topCategories: preferences.categories.slice(0, 3),
        topPlatforms: preferences.platforms.slice(0, 3),
      },
    };
  } catch (error) {
    logger.error('Get personalized recommendations error', { error: error.message, userId });

    // Handle OpenAI API errors
    if (error.response?.status === 429) {
      throw new AppError('AI API rate limit exceeded. Please try again later.', 429);
    }

    // Fallback to basic recommendations if AI fails
    try {
      return await recoveryStrategies.fallback(
        async () => {
          throw error; // Re-throw to trigger fallback
        },
        async () => {
          // Basic recommendations based on user's content
          const basicRecommendations = userContent.slice(0, limit).map((content, idx) => ({
            title: `Content idea ${idx + 1}`,
            description: `Based on your content: ${content.title}`,
            platform: content.platform || 'instagram',
            reasoning: 'Based on your content history',
            keyPoints: content.tags || [],
          }));

          return {
            recommendations: basicRecommendations,
            preferences,
            basedOn: {
              contentAnalyzed: userContent.length,
              topCategories: preferences.categories.slice(0, 3),
              topPlatforms: preferences.platforms.slice(0, 3),
            },
          };
        }
      );
    } catch (fallbackError) {
      throw new ServiceUnavailableError('Recommendations Service');
    }
  }
}

/**
 * Analyze user preferences
 */
function analyzeUserPreferences(userContent) {
  const categories = {};
  const platforms = {};
  const topics = {};
  const topPerformers = [];

  userContent.forEach(content => {
    // Categories
    if (content.category) {
      categories[content.category] = (categories[content.category] || 0) + 1;
    }

    // Platforms
    if (content.platform) {
      platforms[content.platform] = (platforms[content.platform] || 0) + 1;
    }

    // Performance
    const performance = (content.views || 0) + (content.likes || 0) * 10;
    if (performance > 100) {
      topPerformers.push({
        title: content.title,
        performance,
        category: content.category,
        platform: content.platform,
      });
    }
  });

  // Extract topics from titles
  userContent.forEach(content => {
    const words = content.title?.toLowerCase().split(/\s+/) || [];
    words.forEach(word => {
      if (word.length > 4) {
        topics[word] = (topics[word] || 0) + 1;
      }
    });
  });

  return {
    categories: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat),
    platforms: Object.entries(platforms)
      .sort((a, b) => b[1] - a[1])
      .map(([plat]) => plat),
    topTopics: Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic),
    topPerformers: topPerformers
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5),
  };
}

/**
 * Learn from user behavior
 */
async function learnFromBehavior(userId, behaviorData) {
  try {
    const {
      contentId,
      action, // view, like, share, skip
      duration = null,
      platform = null,
    } = behaviorData;

    // In production, store in learning database
    const learning = {
      userId,
      contentId,
      action,
      duration,
      platform,
      timestamp: new Date(),
    };

    logger.info('User behavior learned', { userId, action, contentId });
    return learning;
  } catch (error) {
    logger.error('Learn from behavior error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get content suggestions based on trends
 */
async function getTrendBasedSuggestions(userId, platform) {
  try {
    // In development mode, return mock suggestions for dev users
    if (process.env.NODE_ENV === 'development' && userId && userId.toString().startsWith('dev-')) {
      logger.info('Returning mock trend-based suggestions in development for dev user');
      return {
        suggestions: [
          { id: 'dev-trend-1', title: 'Dev: AI Trends', description: 'Mock AI trend for dev', platform: platform || 'instagram' },
          { id: 'dev-trend-2', title: 'Dev: Short-form Video', description: 'Mock short-form video trend', platform: platform || 'tiktok' }
        ],
        trends: []
      };
    }

    const { analyzeTrends } = require('./aiIdeationService');
    const trends = await analyzeTrends(platform);

    // Get user's content
    const userContent = await Content.find({
      userId,
      status: 'published',
      platform,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title body tags')
      .lean();

    const prompt = `Based on current trends and user's content history, suggest new content:

Trends:
${JSON.stringify(trends, null, 2)}

User's Recent Content:
${userContent.map(c => `- ${c.title}`).join('\n')}

Suggest 5 content ideas that:
1. Align with current trends
2. Build on user's successful content
3. Are timely and relevant
4. Have high engagement potential

Format as JSON array with fields: title, description, trendAlignment (string), expectedEngagement (high/medium/low), keyPoints (array)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate trend suggestions');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a trend-based content strategist. Suggest content that aligns with trends and user history.\n\n${prompt}`;
    const suggestionsText = await geminiGenerate(fullPrompt, { maxTokens: 2000, temperature: 0.8 });

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

    logger.info('Trend-based suggestions generated', { userId, platform, count: suggestions.length });
    return { suggestions, trends };
  } catch (error) {
    logger.error('Get trend-based suggestions error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getPersonalizedRecommendations,
  learnFromBehavior,
  getTrendBasedSuggestions,
};

