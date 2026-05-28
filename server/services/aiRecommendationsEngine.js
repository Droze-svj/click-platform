// AI Recommendations Engine

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { safeJsonParse } = require('../utils/aiRouter');
const Content = require('../models/Content');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const TrendSnapshot = require('../models/TrendSnapshot');
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
  const {
    limit = 10,
    type = null,
    platform = null,
  } = options;
  
  let userContent = [];
  let preferences = { categories: [], platforms: [], topTopics: [] };

  try {
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
    preferences = analyzeUserPreferences(userContent);

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

    const recommendations = safeJsonParse(recommendationsText, null);
    if (!recommendations || !Array.isArray(recommendations)) {
      throw new Error('Failed to parse recommendations or response is not an array');
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

    const suggestions = safeJsonParse(suggestionsText, null);
    if (!suggestions || !Array.isArray(suggestions)) {
      throw new Error('Failed to parse suggestions or response is not an array');
    }

    logger.info('Trend-based suggestions generated', { userId, platform, count: suggestions.length });
    return { suggestions, trends };
  } catch (error) {
    logger.error('Get trend-based suggestions error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Cross-video pattern mining — identifies what's consistently working or failing
 * across the creator's entire published content library.
 */
async function analyzeCrossVideoPatterns(userId) {
  try {
    const isDevUser = userId && (String(userId).startsWith('dev-') || String(userId).startsWith('test-'));
    if (isDevUser) return { topPatterns: [], improvementGaps: [], bestPlatform: null, bestFormat: null, insightSummary: 'No data yet.' };

    const allContent = await Content.find({ userId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title tags category platform views likes type createdAt')
      .lean()
      .catch(() => []);

    if (allContent.length === 0) {
      return { topPatterns: [], improvementGaps: [], bestPlatform: null, bestFormat: null, insightSummary: 'Not enough content history yet.' };
    }

    // Split into top-quartile performers vs. rest (by engagement proxy)
    const scored = allContent.map(c => ({ ...c, _eng: (c.views || 0) + (c.likes || 0) * 10 }));
    scored.sort((a, b) => b._eng - a._eng);
    const topQ = scored.slice(0, Math.max(1, Math.floor(scored.length * 0.25)));

    // Build frequency maps from top performers
    const freq = { platforms: {}, formats: {}, categories: {}, tags: {} };
    topQ.forEach(c => {
      if (c.platform) freq.platforms[c.platform] = (freq.platforms[c.platform] || 0) + 1;
      if (c.type)     freq.formats[c.type]       = (freq.formats[c.type]       || 0) + 1;
      if (c.category) freq.categories[c.category] = (freq.categories[c.category] || 0) + 1;
      (c.tags || []).forEach(t => { freq.tags[t] = (freq.tags[t] || 0) + 1; });
    });

    const topPlatform = Object.entries(freq.platforms).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topFormat   = Object.entries(freq.formats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topTags     = Object.entries(freq.tags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

    if (!geminiConfigured) {
      return { topPatterns: topTags, improvementGaps: [], bestPlatform: topPlatform, bestFormat: topFormat, insightSummary: 'AI analysis unavailable.' };
    }

    const sampleTitles = topQ.slice(0, 3).map(c => c.title).join('; ');
    const prompt = `You are a content performance analyst. A creator's top-quartile videos share these patterns:
Platform frequency: ${JSON.stringify(freq.platforms)}
Format frequency: ${JSON.stringify(freq.formats)}
Category frequency: ${JSON.stringify(freq.categories)}
Top tags: ${topTags.join(', ')}
Sample top titles: "${sampleTitles}"
Total content analysed: ${allContent.length} videos

Return JSON with actionable pattern insights:
{
  "topPatterns": ["3-5 specific patterns that explain why top videos succeed"],
  "improvementGaps": ["2-3 specific gaps or mistakes visible in lower-performing content"],
  "bestPlatform": "${topPlatform || 'unknown'}",
  "bestFormat": "${topFormat || 'unknown'}",
  "insightSummary": "One paragraph executive summary of this creator's content performance DNA"
}
Return ONLY valid JSON.`;

    const raw = await geminiGenerate(prompt, { temperature: 0.4, maxTokens: 1200 });
    const result = safeJsonParse(raw, null);
    if (!result) return { topPatterns: topTags, improvementGaps: [], bestPlatform: topPlatform, bestFormat: topFormat, insightSummary: 'Pattern analysis complete.' };

    logger.info('[CrossVideoPatterns] analysis complete', { userId, contentCount: allContent.length });
    return result;
  } catch (error) {
    logger.error('[CrossVideoPatterns] failed', { error: error.message, userId });
    return { topPatterns: [], improvementGaps: [], bestPlatform: null, bestFormat: null, insightSummary: 'Analysis unavailable.' };
  }
}

/**
 * Trend matching — scores current platform trends against the creator's niche and style,
 * then generates a content angle + suggested hook for each matched trend.
 */
async function matchTrendsToCreator(userId, platform = 'tiktok') {
  try {
    const isDevUser = userId && (String(userId).startsWith('dev-') || String(userId).startsWith('test-'));

    // Fetch latest trend snapshot for the platform
    const snapshot = await TrendSnapshot.findOne({ platform }).sort({ capturedAt: -1 }).lean().catch(() => null);
    const trends = snapshot?.items || [];

    // Fetch creator niche + top hooks from UserPreferences
    const prefs = isDevUser ? null : await UserPreferences.findOne({ userId }).lean().catch(() => null);
    const niche = prefs?.marketingIntelligence?.niche || 'general';
    const topHooks = prefs?.marketingIntelligence?.historicalPerformanceMetrics?.topPerformingHooks || [];

    if (trends.length === 0) {
      return [{ trend: 'No trend data available', relevanceScore: 0, contentAngle: 'Check back later', suggestedHook: '', estimatedFit: 'unknown' }];
    }

    // Score each trend by keyword overlap with niche + top hooks
    const nicheWords = niche.toLowerCase().split(/\s+/);
    const hookWords  = topHooks.join(' ').toLowerCase().split(/\s+/);

    const scored = trends.map(item => {
      const label = (item.label || '').toLowerCase();
      const nicheOverlap = nicheWords.filter(w => w.length > 3 && label.includes(w)).length / Math.max(nicheWords.length, 1);
      const hookOverlap  = hookWords.filter(w => w.length > 3 && label.includes(w)).length / Math.max(hookWords.length, 1);
      return { ...item, relevanceScore: Math.round(((nicheOverlap + hookOverlap) / 2) * 100) / 100 };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const top5 = scored.slice(0, 5);

    if (!geminiConfigured) {
      return top5.map(t => ({ trend: t.label, relevanceScore: t.relevanceScore, contentAngle: 'Use this trend in your next video', suggestedHook: `"${t.label}" changed everything...`, estimatedFit: t.relevanceScore > 0.3 ? 'high' : 'medium' }));
    }

    const prompt = `You are a viral content strategist. For each trending topic below, generate a specific content angle and hook optimised for a creator in the "${niche}" niche.

Trends: ${JSON.stringify(top5.map(t => ({ trend: t.label, velocity: t.velocity, relevanceScore: t.relevanceScore })))}
Creator's top hook styles: ${topHooks.join(', ') || 'curiosity-gap, story'}

Return a JSON array (one entry per trend):
[
  {
    "trend": "trend label",
    "relevanceScore": 0.0,
    "contentAngle": "specific angle this creator should take on the trend",
    "suggestedHook": "an exact opening line the creator could use (max 12 words)",
    "estimatedFit": "high|medium|low"
  }
]
Return ONLY valid JSON.`;

    const raw = await geminiGenerate(prompt, { temperature: 0.7, maxTokens: 900 });
    const result = safeJsonParse(raw, null);
    if (!Array.isArray(result)) {
      return top5.map(t => ({ trend: t.label, relevanceScore: t.relevanceScore, contentAngle: `Create content about ${t.label}`, suggestedHook: `Everyone's talking about ${t.label}...`, estimatedFit: 'medium' }));
    }

    logger.info('[TrendMatch] matched trends to creator', { userId, platform, count: result.length });
    return result;
  } catch (error) {
    logger.error('[TrendMatch] failed', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  getPersonalizedRecommendations,
  learnFromBehavior,
  getTrendBasedSuggestions,
  analyzeCrossVideoPatterns,
  matchTrendsToCreator,
};

