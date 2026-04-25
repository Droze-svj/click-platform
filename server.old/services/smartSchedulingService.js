// Smart Scheduling Service

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Smart schedule content
 */
async function smartScheduleContent(userId, contentId, options = {}) {
  try {
    const {
      platforms = ['instagram', 'twitter', 'linkedin'],
      preferredTimes = null,
      avoidTimes = null,
      minSpacing = 2, // hours between posts
    } = options;

    // Get optimal times
    const { getOptimalPostingTimes } = require('./contentCalendarService');
    const optimalTimes = await getOptimalPostingTimes(userId, platforms);

    // Get existing scheduled posts
    const existingPosts = await ScheduledPost.find({
      userId,
      status: { $in: ['pending', 'scheduled'] },
    })
      .sort({ scheduledTime: 1 })
      .lean();

    const schedules = [];
    const now = new Date();
    let currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);

    for (const platform of platforms) {
      const platformOptimalTimes = optimalTimes[platform] || ['09:00', '13:00', '17:00'];
      const optimalTime = preferredTimes?.[platform] || platformOptimalTimes[0];
      const [hour, minute] = optimalTime.split(':').map(Number);

      // Find next available slot
      let scheduledTime = new Date(currentDate);
      scheduledTime.setHours(hour, minute, 0, 0);

      // Ensure it's in the future
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      // Check spacing
      let attempts = 0;
      while (attempts < 30) {
        const tooClose = existingPosts.some(post => {
          const timeDiff = Math.abs(post.scheduledTime - scheduledTime) / (1000 * 60 * 60);
          return timeDiff < minSpacing;
        });

        if (!tooClose && (!avoidTimes || !isInAvoidTime(scheduledTime, avoidTimes))) {
          break;
        }

        scheduledTime.setHours(scheduledTime.getHours() + 1);
        attempts++;
      }

      schedules.push({
        userId,
        contentId,
        platform,
        scheduledTime,
        status: 'pending',
        smartScheduled: true,
      });
    }

    const created = await ScheduledPost.insertMany(schedules);

    logger.info('Content smart scheduled', {
      userId,
      contentId,
      count: created.length,
    });

    return {
      success: true,
      schedules: created.map(s => ({
        id: s._id,
        platform: s.platform,
        scheduledTime: s.scheduledTime,
      })),
    };
  } catch (error) {
    logger.error('Smart schedule content error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Optimize content mix
 */
async function optimizeContentMix(userId, dateRange = 7) {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);

    // Get scheduled content
    const scheduled = await ScheduledPost.find({
      userId,
      scheduledTime: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate('contentId', 'type category tags')
      .lean();

    // Analyze content mix
    const mix = {
      byPlatform: {},
      byType: {},
      byCategory: {},
      byDay: {},
    };

    scheduled.forEach(post => {
      const platform = post.platform;
      const content = post.contentId;
      const day = new Date(post.scheduledTime).toLocaleDateString('en-US', { weekday: 'long' });

      // Platform distribution
      mix.byPlatform[platform] = (mix.byPlatform[platform] || 0) + 1;

      // Type distribution
      if (content?.type) {
        mix.byType[content.type] = (mix.byType[content.type] || 0) + 1;
      }

      // Category distribution
      if (content?.category) {
        mix.byCategory[content.category] = (mix.byCategory[content.category] || 0) + 1;
      }

      // Day distribution
      mix.byDay[day] = (mix.byDay[day] || 0) + 1;
    });

    // Generate recommendations
    const recommendations = generateMixRecommendations(mix, dateRange);

    return {
      mix,
      recommendations,
      totalScheduled: scheduled.length,
    };
  } catch (error) {
    logger.error('Optimize content mix error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate mix recommendations
 */
function generateMixRecommendations(mix, days) {
  const recommendations = [];

  // Check platform balance
  const platforms = Object.keys(mix.byPlatform);
  const avgPerPlatform = Object.values(mix.byPlatform).reduce((a, b) => a + b, 0) / platforms.length;
  
  platforms.forEach(platform => {
    const count = mix.byPlatform[platform];
    if (count < avgPerPlatform * 0.7) {
      recommendations.push({
        type: 'platform_balance',
        message: `Consider scheduling more content for ${platform}`,
        priority: 'medium',
      });
    }
  });

  // Check type diversity
  const types = Object.keys(mix.byType);
  if (types.length < 2) {
    recommendations.push({
      type: 'type_diversity',
      message: 'Consider diversifying content types (video, article, etc.)',
      priority: 'high',
    });
  }

  // Check daily distribution
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const activeDays = Object.keys(mix.byDay);
  const missingDays = daysOfWeek.filter(day => !activeDays.includes(day));

  if (missingDays.length > 0) {
    recommendations.push({
      type: 'daily_distribution',
      message: `Consider scheduling content for: ${missingDays.join(', ')}`,
      priority: 'low',
    });
  }

  return recommendations;
}

/**
 * Check if time is in avoid times
 */
function isInAvoidTime(time, avoidTimes) {
  if (!avoidTimes) return false;

  const hour = time.getHours();
  const dayOfWeek = time.getDay();

  if (avoidTimes.hours && avoidTimes.hours.includes(hour)) {
    return true;
  }

  if (avoidTimes.days && avoidTimes.days.includes(dayOfWeek)) {
    return true;
  }

  return false;
}

/**
 * Plan seasonal content
 */
async function planSeasonalContent(userId, season, platforms) {
  try {
    const { getSeasonalTrends } = require('./contentTemplateService');
    const trends = await getSeasonalTrends(season);

    // Get user's content library
    const contentLibrary = await Content.find({
      userId,
      status: { $in: ['draft', 'published'] },
    })
      .select('title body tags category')
      .limit(50)
      .lean();

    // Match content to seasonal trends
    const seasonalMatches = contentLibrary
      .map(content => {
        const relevance = calculateSeasonalRelevance(content, trends);
        return {
          contentId: content._id,
          title: content.title,
          relevance,
        };
      })
      .filter(item => item.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);

    return {
      season,
      trends,
      recommendedContent: seasonalMatches,
      suggestedThemes: trends.themes || [],
    };
  } catch (error) {
    logger.error('Plan seasonal content error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate seasonal relevance
 */
function calculateSeasonalRelevance(content, trends) {
  let relevance = 0;
  const contentText = `${content.title} ${content.body}`.toLowerCase();
  const trendTopics = (trends.trendingTopics || []).map(t => t.toLowerCase());
  const trendHashtags = (trends.seasonalHashtags || []).map(h => h.toLowerCase().replace('#', ''));

  // Check topic matches
  trendTopics.forEach(topic => {
    if (contentText.includes(topic)) {
      relevance += 0.2;
    }
  });

  // Check hashtag matches
  const contentHashtags = (content.tags || []).map(t => t.toLowerCase());
  trendHashtags.forEach(hashtag => {
    if (contentHashtags.includes(hashtag)) {
      relevance += 0.1;
    }
  });

  return Math.min(relevance, 1);
}

module.exports = {
  smartScheduleContent,
  optimizeContentMix,
  planSeasonalContent,
};






