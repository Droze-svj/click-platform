// Enhanced AI content suggestions service

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');
const { generateAIResponse } = require('./aiService');

/**
 * Get trending topics
 */
async function getTrendingTopics(niche = 'general') {
  try {
    // In a real implementation, this would call an external API
    // For now, return niche-specific suggestions
    const topicsByNiche = {
      health: [
        'Mental health awareness',
        'Fitness trends 2024',
        'Nutrition tips',
        'Wellness routines',
        'Sleep optimization'
      ],
      finance: [
        'Investment strategies',
        'Budgeting tips',
        'Cryptocurrency trends',
        'Real estate investing',
        'Financial planning'
      ],
      technology: [
        'AI developments',
        'Tech innovations',
        'Software tools',
        'Gadget reviews',
        'Tech tutorials'
      ],
      business: [
        'Entrepreneurship tips',
        'Marketing strategies',
        'Business growth',
        'Leadership advice',
        'Startup stories'
      ],
      education: [
        'Learning techniques',
        'Online courses',
        'Study tips',
        'Career advice',
        'Skill development'
      ],
      lifestyle: [
        'Productivity hacks',
        'Life organization',
        'Travel tips',
        'Home decor',
        'Personal development'
      ],
      entertainment: [
        'Movie reviews',
        'TV show recommendations',
        'Music trends',
        'Gaming content',
        'Celebrity news'
      ],
      general: [
        'Daily inspiration',
        'Life lessons',
        'Motivational content',
        'Trending discussions',
        'Viral topics'
      ]
    };

    return topicsByNiche[niche] || topicsByNiche.general;
  } catch (error) {
    logger.error('Error getting trending topics', { error: error.message });
    return [];
  }
}

/**
 * Get content gap analysis
 */
async function getContentGaps(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get user's content
    const userContent = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    });

    // Get user's posts
    const userPosts = await ScheduledPost.find({
      userId,
      createdAt: { $gte: startDate }
    });

    // Analyze gaps
    const gaps = {
      daysWithoutContent: [],
      missingPlatforms: [],
      lowEngagementTypes: [],
      suggestions: []
    };

    // Find days without content
    const contentDays = new Set(
      userContent.map(c => c.createdAt.toISOString().split('T')[0])
    );
    const postDays = new Set(
      userPosts.map(p => p.createdAt.toISOString().split('T')[0])
    );

    for (let i = 0; i < period; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!contentDays.has(dateStr) && !postDays.has(dateStr)) {
        gaps.daysWithoutContent.push(dateStr);
      }
    }

    // Find missing platforms
    const usedPlatforms = new Set(userPosts.map(p => p.platform));
    const allPlatforms = ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'];
    gaps.missingPlatforms = allPlatforms.filter(p => !usedPlatforms.has(p));

    // Find low engagement content types
    const typeEngagement = {};
    userContent.forEach(content => {
      if (!typeEngagement[content.type]) {
        typeEngagement[content.type] = { count: 0, totalEngagement: 0 };
      }
      typeEngagement[content.type].count++;
    });

    userPosts.forEach(post => {
      if (post.analytics && post.analytics.engagement) {
        const content = userContent.find(c => {
          if (post.content && post.content.contentId) {
            return c._id.toString() === post.content.contentId.toString();
          }
          return false;
        });
        if (content && typeEngagement[content.type]) {
          typeEngagement[content.type].totalEngagement += post.analytics.engagement;
        }
      }
    });

    gaps.lowEngagementTypes = Object.entries(typeEngagement)
      .filter(([type, data]) => data.count > 0 && (data.totalEngagement / data.count) < 10)
      .map(([type]) => type);

    // Generate suggestions
    if (gaps.daysWithoutContent.length > 7) {
      gaps.suggestions.push({
        type: 'frequency',
        message: `You have ${gaps.daysWithoutContent.length} days without content. Consider posting more regularly.`,
        priority: 'high'
      });
    }

    if (gaps.missingPlatforms.length > 0) {
      gaps.suggestions.push({
        type: 'platform',
        message: `You're not using ${gaps.missingPlatforms.join(', ')}. Consider diversifying your platforms.`,
        priority: 'medium'
      });
    }

    if (gaps.lowEngagementTypes.length > 0) {
      gaps.suggestions.push({
        type: 'content',
        message: `${gaps.lowEngagementTypes.join(', ')} content is underperforming. Try different approaches.`,
        priority: 'medium'
      });
    }

    return gaps;
  } catch (error) {
    logger.error('Error getting content gaps', { error: error.message, userId });
    return { daysWithoutContent: [], missingPlatforms: [], lowEngagementTypes: [], suggestions: [] };
  }
}

/**
 * Get viral content predictions
 */
async function getViralPredictions(userId, contentData) {
  try {
    // Simple prediction based on content characteristics
    let viralScore = 0;
    const factors = [];

    // Title length (optimal: 40-60 chars)
    if (contentData.title) {
      const titleLength = contentData.title.length;
      if (titleLength >= 40 && titleLength <= 60) {
        viralScore += 20;
        factors.push('Optimal title length');
      } else {
        factors.push('Title length could be optimized');
      }
    }

    // Hashtags (optimal: 3-5)
    if (contentData.tags && contentData.tags.length >= 3 && contentData.tags.length <= 5) {
      viralScore += 15;
      factors.push('Good hashtag count');
    }

    // Content type
    const typeScores = {
      video: 25,
      article: 15,
      podcast: 20,
      transcript: 10
    };
    viralScore += typeScores[contentData.type] || 10;
    factors.push(`${contentData.type} content type`);

    // Category relevance
    if (contentData.category) {
      viralScore += 10;
      factors.push('Category defined');
    }

    // Time of posting (would need historical data)
    viralScore += 10;
    factors.push('Timing consideration');

    // Engagement hooks
    if (contentData.description && (
      contentData.description.includes('?') ||
      contentData.description.includes('!') ||
      contentData.description.includes('How') ||
      contentData.description.includes('Why')
    )) {
      viralScore += 10;
      factors.push('Engaging hook detected');
    }

    const prediction = {
      viralScore: Math.min(viralScore, 100),
      potential: viralScore >= 70 ? 'high' : viralScore >= 50 ? 'medium' : 'low',
      factors,
      recommendations: []
    };

    if (viralScore < 50) {
      prediction.recommendations.push('Add more engaging hooks to your content');
      prediction.recommendations.push('Consider using video format for better engagement');
      prediction.recommendations.push('Optimize your title length (40-60 characters)');
    }

    return prediction;
  } catch (error) {
    logger.error('Error getting viral predictions', { error: error.message });
    return {
      viralScore: 0,
      potential: 'unknown',
      factors: [],
      recommendations: []
    };
  }
}

/**
 * Get enhanced content suggestions
 */
async function getEnhancedSuggestions(userId, options = {}) {
  try {
    const {
      niche = 'general',
      count = 10,
      includeTrending = true,
      includeGaps = true,
      includeSeasonal = true
    } = options;

    const suggestions = [];

    // Trending topics
    if (includeTrending) {
      try {
        const trending = await getTrendingTopics(niche);
        if (Array.isArray(trending)) {
          trending.slice(0, 5).forEach(topic => {
            suggestions.push({
              type: 'trending',
              title: topic,
              description: `Trending topic in ${niche} niche`,
              priority: 'high',
              source: 'trending'
            });
          });
        }
      } catch (error) {
        logger.error('Error getting trending topics in enhanced suggestions', { error: error.message, userId });
      }
    }

    // Content gaps
    if (includeGaps) {
      try {
        const gaps = await getContentGaps(userId);
        if (gaps && gaps.suggestions && Array.isArray(gaps.suggestions)) {
          gaps.suggestions.forEach(suggestion => {
            suggestions.push({
              type: 'gap',
              title: suggestion.message,
              description: 'Based on your content analysis',
              priority: suggestion.priority,
              source: 'gap-analysis'
            });
          });
        }
      } catch (error) {
        logger.error('Error getting content gaps in enhanced suggestions', { error: error.message, userId });
      }
    }

    // Seasonal content
    if (includeSeasonal) {
      const month = new Date().getMonth();
      const seasonalTopics = {
        0: ['New Year resolutions', 'Winter productivity', 'Goal setting'],
        1: ['Valentine\'s Day content', 'Love and relationships', 'February motivation'],
        2: ['Spring cleaning', 'Fresh starts', 'March goals'],
        3: ['April productivity', 'Spring growth', 'Q2 planning'],
        4: ['May motivation', 'Summer prep', 'Mid-year review'],
        5: ['Summer content', 'Vacation tips', 'June goals'],
        6: ['July inspiration', 'Mid-year check-in', 'Summer productivity'],
        7: ['Back to school', 'August planning', 'Fall preparation'],
        8: ['September goals', 'Fall content', 'Q4 planning'],
        9: ['October themes', 'Halloween content', 'Autumn vibes'],
        10: ['November gratitude', 'Thanksgiving content', 'Year-end prep'],
        11: ['December holidays', 'Year in review', 'New Year planning']
      };

      const monthlyTopics = seasonalTopics[month] || [];
      monthlyTopics.forEach(topic => {
        suggestions.push({
          type: 'seasonal',
          title: topic,
          description: 'Seasonal content opportunity',
          priority: 'medium',
          source: 'seasonal'
        });
      });
    }

    // Limit to requested count
    return suggestions.slice(0, count);
  } catch (error) {
    logger.error('Error getting enhanced suggestions', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  getTrendingTopics,
  getContentGaps,
  getViralPredictions,
  getEnhancedSuggestions
};

