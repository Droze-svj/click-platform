// AI Recommendations Engine

const { OpenAI } = require('openai');
const Content = require('../models/Content');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  AppError,
  NotFoundError,
  ServiceUnavailableError,
  recoveryStrategies,
} = require('../utils/errorHandler');

// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client for AI recommendations', { error: error.message });
      return null;
    }
  }
  return openai;
}

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

    // Get user's content history
    const userContent = await Content.find({
      userId,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title body tags category platform views likes')
      .lean();

    // Get user profile
    const user = await User.findById(userId).select('name email preferences').lean();

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

Format as JSON array with fields: title, description, platform, reasoning, keyPoints (array)`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate recommendations');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a content recommendation engine. Provide personalized, data-driven recommendations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const recommendationsText = response.choices[0].message.content;
    
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

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate recommendations');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a trend-based content strategist. Suggest content that aligns with trends and user history.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
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

