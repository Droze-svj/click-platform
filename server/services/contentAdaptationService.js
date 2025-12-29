// Content Adaptation Service
// AI-powered content adaptation for different platforms with minimal friction

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');
const { generateContentAdaptation } = require('./aiService');

/**
 * Adapt content for multiple platforms
 */
async function adaptContent(userId, contentId, text, title, platforms) {
  try {
    const adaptations = [];

    for (const platform of platforms) {
      const adaptation = await adaptForPlatform(platform, text, title, userId);
      adaptations.push({
        platform,
        content: adaptation.content,
        hashtags: adaptation.hashtags,
        optimized: false,
        score: adaptation.score || 85,
        suggestions: adaptation.suggestions || []
      });
    }

    // Save adaptations to content
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        'generatedContent.adaptations': adaptations
      }
    });

    return { adaptations };
  } catch (error) {
    logger.error('Error adapting content', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Adapt content for a specific platform
 */
async function adaptForPlatform(platform, text, title, userId) {
  try {
    // Get platform-specific rules and best practices
    const platformRules = getPlatformRules(platform);
    
    // Get user's best performing content for this platform
    const bestPerforming = await getBestPerformingContent(userId, platform);
    
    // Generate adaptation using AI
    const adaptation = await generateContentAdaptation({
      text,
      title,
      platform,
      rules: platformRules,
      examples: bestPerforming
    });

    return {
      content: adaptation.content || text,
      hashtags: adaptation.hashtags || [],
      score: adaptation.score || 85,
      suggestions: adaptation.suggestions || []
    };
  } catch (error) {
    logger.error('Error adapting for platform', { error: error.message, platform });
    // Fallback to basic adaptation
    return {
      content: text,
      hashtags: [],
      score: 70,
      suggestions: ['Consider adding platform-specific formatting']
    };
  }
}

/**
 * Get platform-specific rules
 */
function getPlatformRules(platform) {
  const rules = {
    twitter: {
      maxLength: 280,
      hashtags: 2,
      mentions: true,
      emojis: true,
      callToAction: true
    },
    linkedin: {
      maxLength: 3000,
      hashtags: 5,
      professional: true,
      longForm: true,
      callToAction: true
    },
    facebook: {
      maxLength: 5000,
      hashtags: 3,
      casual: true,
      engaging: true,
      callToAction: true
    },
    instagram: {
      maxLength: 2200,
      hashtags: 10,
      visual: true,
      emojis: true,
      callToAction: true
    },
    youtube: {
      maxLength: 5000,
      hashtags: 5,
      descriptive: true,
      keywords: true,
      callToAction: true
    },
    tiktok: {
      maxLength: 300,
      hashtags: 5,
      trending: true,
      engaging: true,
      callToAction: true
    }
  };

  return rules[platform.toLowerCase()] || rules.twitter;
}

/**
 * Get best performing content for a platform
 */
async function getBestPerformingContent(userId, platform, limit = 3) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      platform: platform.toLowerCase(),
      status: 'posted',
      'analytics.engagement': { $exists: true }
    })
    .sort({ 'analytics.engagement': -1 })
    .limit(limit)
    .populate('content.contentId')
    .lean();

    return posts.map(post => ({
      content: post.content?.text || '',
      engagement: post.analytics?.engagement || 0,
      hashtags: post.content?.hashtags || []
    }));
  } catch (error) {
    logger.error('Error getting best performing content', { error: error.message });
    return [];
  }
}

/**
 * One-click repurpose content
 */
async function oneClickRepurpose(userId, contentId, targetPlatforms) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const sourceText = content.transcript || content.description || '';
    const title = content.title || 'Untitled';

    // Adapt for all target platforms
    const adaptations = await adaptContent(
      userId,
      contentId,
      sourceText,
      title,
      targetPlatforms
    );

    // Create scheduled posts for each platform
    const scheduledPosts = [];
    for (const adaptation of adaptations.adaptations) {
      const post = new ScheduledPost({
        userId,
        platform: adaptation.platform,
        content: {
          text: adaptation.content,
          hashtags: adaptation.hashtags,
          contentId: contentId
        },
        status: 'draft',
        scheduledTime: new Date()
      });
      await post.save();
      scheduledPosts.push(post);
    }

    logger.info('Content repurposed', { userId, contentId, platforms: targetPlatforms });

    return {
      success: true,
      adaptations: adaptations.adaptations,
      scheduledPosts: scheduledPosts.map(p => ({
        id: p._id,
        platform: p.platform,
        status: p.status
      }))
    };
  } catch (error) {
    logger.error('Error in one-click repurpose', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get smart content suggestions based on performance
 */
async function getSmartSuggestions(userId, limit = 5) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    // Get best performing content
    const bestPosts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate },
      'analytics.engagement': { $exists: true }
    })
    .sort({ 'analytics.engagement': -1 })
    .limit(10)
    .populate('content.contentId')
    .lean();

    // Analyze patterns
    const suggestions = [];

    // Content type suggestions
    const typeCounts = {};
    bestPosts.forEach(post => {
      const type = post.content?.contentId?.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const bestType = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b,
      Object.keys(typeCounts)[0]
    );

    if (bestType && bestType !== 'unknown') {
      suggestions.push({
        type: 'content_type',
        title: `Create More ${bestType.charAt(0).toUpperCase() + bestType.slice(1)} Content`,
        description: `Your ${bestType} content performs best. Consider creating similar content.`,
        action: `Create ${bestType}`,
        priority: 'high'
      });
    }

    // Platform suggestions
    const platformCounts = {};
    bestPosts.forEach(post => {
      const platform = post.platform;
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    const bestPlatform = Object.keys(platformCounts).reduce((a, b) => 
      platformCounts[a] > platformCounts[b] ? a : b,
      Object.keys(platformCounts)[0]
    );

    if (bestPlatform) {
      suggestions.push({
        type: 'platform',
        title: `Focus on ${bestPlatform.charAt(0).toUpperCase() + bestPlatform.slice(1)}`,
        description: `Your ${bestPlatform} posts get the most engagement. Post more there.`,
        action: `Post to ${bestPlatform}`,
        priority: 'medium'
      });
    }

    // Hashtag suggestions
    const hashtagCounts = {};
    bestPosts.forEach(post => {
      if (post.content?.hashtags) {
        post.content.hashtags.forEach(tag => {
          hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
        });
      }
    });

    const topHashtags = Object.keys(hashtagCounts)
      .sort((a, b) => hashtagCounts[b] - hashtagCounts[a])
      .slice(0, 5);

    if (topHashtags.length > 0) {
      suggestions.push({
        type: 'hashtags',
        title: 'Use These High-Performing Hashtags',
        description: `These hashtags appear in your best posts: ${topHashtags.join(', ')}`,
        action: 'Apply Hashtags',
        priority: 'medium',
        hashtags: topHashtags
      });
    }

    // Time-based suggestions
    const hourCounts = {};
    bestPosts.forEach(post => {
      const hour = new Date(post.postedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const bestHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b,
      Object.keys(hourCounts)[0]
    );

    if (bestHour) {
      suggestions.push({
        type: 'timing',
        title: `Post at ${bestHour}:00 for Best Results`,
        description: `Your posts at ${bestHour}:00 get the most engagement. Schedule content for this time.`,
        action: 'Schedule Post',
        priority: 'high'
      });
    }

    return suggestions.slice(0, limit);
  } catch (error) {
    logger.error('Error getting smart suggestions', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  adaptContent,
  adaptForPlatform,
  oneClickRepurpose,
  getSmartSuggestions,
};


