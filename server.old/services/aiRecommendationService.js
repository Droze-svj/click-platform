// AI-powered content recommendation service

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get AI-powered content recommendations
 */
async function getContentRecommendations(userId, options = {}) {
  try {
    const {
      limit = 10,
      type = 'all',
      category = null,
      niche = null
    } = options;

    // Analyze user's content history
    const userContent = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Analyze engagement patterns
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted'
    })
      .sort({ scheduledTime: -1 })
      .limit(100)
      .lean();

    // Generate recommendations based on:
    // 1. Content performance
    // 2. Trending topics
    // 3. User preferences
    // 4. Seasonal relevance
    const recommendations = await generateRecommendations(userContent, posts, {
      limit,
      type,
      category,
      niche
    });

    return recommendations;
  } catch (error) {
    logger.error('Error getting content recommendations', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate recommendations
 */
async function generateRecommendations(userContent, posts, options) {
  const recommendations = [];

  // Analyze best performing content
  const topPosts = posts
    .filter(p => p.engagement > 0)
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 5);

  // Recommend similar content
  for (const post of topPosts) {
    if (post.content?.text) {
      recommendations.push({
        type: 'similar',
        title: `Create content similar to: "${post.content.text.substring(0, 50)}..."`,
        description: `This post performed well with ${post.engagement} engagement`,
        priority: 'high',
        suggestedPlatforms: [post.platform],
        estimatedEngagement: post.engagement * 0.8 // Conservative estimate
      });
    }
  }

  // Trending topics
  const trendingTopics = getTrendingTopics();
  trendingTopics.forEach(topic => {
    recommendations.push({
      type: 'trending',
      title: `Create content about: ${topic.title}`,
      description: topic.description,
      priority: 'medium',
      suggestedPlatforms: topic.platforms,
      hashtags: topic.hashtags,
      estimatedEngagement: topic.estimatedEngagement
    });
  });

  // Content gaps
  const gaps = detectContentGaps(userContent, posts);
  gaps.forEach(gap => {
    recommendations.push({
      type: 'gap',
      title: `Fill content gap: ${gap.type}`,
      description: gap.description,
      priority: 'medium',
      suggestedPlatforms: gap.platforms,
      estimatedEngagement: gap.estimatedEngagement
    });
  });

  // Seasonal content
  const seasonal = getSeasonalRecommendations();
  seasonal.forEach(item => {
    recommendations.push({
      type: 'seasonal',
      title: item.title,
      description: item.description,
      priority: 'high',
      suggestedPlatforms: item.platforms,
      hashtags: item.hashtags,
      estimatedEngagement: item.estimatedEngagement
    });
  });

  // Sort by priority and estimated engagement
  return recommendations
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return (b.estimatedEngagement || 0) - (a.estimatedEngagement || 0);
    })
    .slice(0, options.limit);
}

/**
 * Get trending topics
 */
function getTrendingTopics() {
  const currentDate = new Date();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  // Simple trending topics based on current events
  const topics = [
    {
      title: 'AI and Technology Trends',
      description: 'Create content about latest AI developments and tech trends',
      platforms: ['twitter', 'linkedin'],
      hashtags: ['#AI', '#TechTrends', '#Innovation'],
      estimatedEngagement: 150
    },
    {
      title: 'Productivity Tips',
      description: 'Share productivity tips and life hacks',
      platforms: ['twitter', 'linkedin', 'instagram'],
      hashtags: ['#Productivity', '#LifeHacks', '#Tips'],
      estimatedEngagement: 120
    }
  ];

  return topics;
}

/**
 * Detect content gaps
 */
function detectContentGaps(userContent, posts) {
  const gaps = [];

  // Check for platform gaps
  const platforms = ['twitter', 'linkedin', 'facebook', 'instagram'];
  const usedPlatforms = new Set(posts.map(p => p.platform));
  const missingPlatforms = platforms.filter(p => !usedPlatforms.has(p));

  if (missingPlatforms.length > 0) {
    gaps.push({
      type: 'platform',
      description: `You haven't posted on ${missingPlatforms.join(', ')} yet`,
      platforms: missingPlatforms,
      estimatedEngagement: 100
    });
  }

  // Check for content type gaps
  const contentTypes = ['video', 'article', 'quote', 'podcast'];
  const usedTypes = new Set(userContent.map(c => c.type));
  const missingTypes = contentTypes.filter(t => !usedTypes.has(t));

  if (missingTypes.length > 0) {
    gaps.push({
      type: 'content_type',
      description: `Try creating ${missingTypes.join(' or ')} content`,
      platforms: ['twitter', 'linkedin'],
      estimatedEngagement: 80
    });
  }

  return gaps;
}

/**
 * Get seasonal recommendations
 */
function getSeasonalRecommendations() {
  const currentDate = new Date();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const recommendations = [];

  // New Year
  if (month === 0 && day <= 7) {
    recommendations.push({
      title: 'New Year Goals and Resolutions',
      description: 'Create content about setting goals and new year resolutions',
      platforms: ['linkedin', 'twitter'],
      hashtags: ['#NewYear', '#Goals', '#Resolutions'],
      estimatedEngagement: 200
    });
  }

  // Back to School (August-September)
  if (month === 7 || month === 8) {
    recommendations.push({
      title: 'Back to School Tips',
      description: 'Share educational content and back-to-school tips',
      platforms: ['twitter', 'linkedin', 'instagram'],
      hashtags: ['#BackToSchool', '#Education', '#Learning'],
      estimatedEngagement: 180
    });
  }

  // Holiday season (November-December)
  if (month === 10 || month === 11) {
    recommendations.push({
      title: 'Holiday Content Ideas',
      description: 'Create festive and holiday-themed content',
      platforms: ['instagram', 'facebook', 'twitter'],
      hashtags: ['#Holidays', '#Festive', '#Celebration'],
      estimatedEngagement: 250
    });
  }

  return recommendations;
}

/**
 * Get viral content predictions
 */
async function predictViralContent(userId, contentData) {
  try {
    // Analyze content for viral potential
    const factors = {
      hashtags: contentData.hashtags?.length || 0,
      mentions: (contentData.text?.match(/@\w+/g) || []).length,
      question: contentData.text?.includes('?') ? 1 : 0,
      emoji: (contentData.text?.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
      length: contentData.text?.length || 0,
      platform: contentData.platform || 'twitter'
    };

    // Calculate viral score (0-100)
    let score = 0;
    
    // Hashtags (max 20 points)
    score += Math.min(factors.hashtags * 2, 20);
    
    // Mentions (max 15 points)
    score += Math.min(factors.mentions * 3, 15);
    
    // Question (10 points)
    score += factors.question * 10;
    
    // Emoji (max 15 points)
    score += Math.min(factors.emoji * 2, 15);
    
    // Optimal length (max 20 points)
    const optimalLength = factors.platform === 'twitter' ? 280 : 200;
    const lengthScore = 20 - Math.abs(factors.length - optimalLength) / 10;
    score += Math.max(0, lengthScore);
    
    // Platform bonus (max 20 points)
    const platformBonus = {
      twitter: 15,
      instagram: 20,
      linkedin: 10,
      facebook: 12
    };
    score += platformBonus[factors.platform] || 10;

    const potential = score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';

    return {
      viralScore: Math.round(score),
      potential,
      factors: {
        hashtags: factors.hashtags,
        mentions: factors.mentions,
        hasQuestion: factors.question > 0,
        emojiCount: factors.emoji,
        length: factors.length
      },
      recommendations: generateViralRecommendations(score, factors)
    };
  } catch (error) {
    logger.error('Error predicting viral content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate viral recommendations
 */
function generateViralRecommendations(score, factors) {
  const recommendations = [];

  if (factors.hashtags < 3) {
    recommendations.push('Add 3-5 relevant hashtags to increase discoverability');
  }

  if (factors.mentions === 0) {
    recommendations.push('Mention relevant accounts to increase engagement');
  }

  if (factors.question === 0) {
    recommendations.push('Ask a question to encourage comments and engagement');
  }

  if (factors.emoji < 2) {
    recommendations.push('Add emojis to make your content more engaging');
  }

  if (factors.length < 100) {
    recommendations.push('Expand your content to provide more value');
  }

  if (score < 50) {
    recommendations.push('Consider posting at optimal times for better reach');
  }

  return recommendations;
}

module.exports = {
  getContentRecommendations,
  predictViralContent
};







