// Advanced Evergreen Content Detection Service
// Detects evergreen content and auto-builds recycling calendars

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentRecycle = require('../models/ContentRecycle');
const logger = require('../utils/logger');

/**
 * Advanced evergreen content detection
 */
async function detectEvergreenContent(userId, options = {}) {
  try {
    const {
      minEngagement = 100,
      minEngagementRate = 0.05,
      timeDecay = 0.1,
      minAge = 30, // days
      platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minAge);

    // Get all posted content
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: cutoffDate }
    })
      .populate('contentId')
      .lean();

    const evergreenContent = [];

    for (const post of posts) {
      if (!post.contentId || !post.analytics) continue;

      const engagement = post.analytics.engagement || 0;
      const impressions = post.analytics.impressions || 1;
      const engagementRate = engagement / impressions;

      // Calculate evergreen score
      const score = calculateEvergreenScore(
        post,
        engagement,
        engagementRate,
        minEngagement,
        minEngagementRate,
        timeDecay
      );

      if (score >= 0.7) {
        evergreenContent.push({
          contentId: post.contentId._id || post.contentId,
          postId: post._id,
          platform: post.platform,
          score,
          engagement,
          engagementRate,
          postedAt: post.postedAt,
          content: post.contentId
        });
      }
    }

    // Group by content (same content across platforms)
    const contentMap = new Map();
    evergreenContent.forEach(item => {
      const contentId = item.contentId.toString();
      if (!contentMap.has(contentId)) {
        contentMap.set(contentId, {
          contentId: item.contentId,
          content: item.content,
          platforms: [],
          avgScore: 0,
          totalEngagement: 0,
          bestPlatform: null,
          bestScore: 0
        });
      }

      const entry = contentMap.get(contentId);
      entry.platforms.push({
        platform: item.platform,
        score: item.score,
        engagement: item.engagement,
        engagementRate: item.engagementRate,
        postedAt: item.postedAt
      });

      entry.totalEngagement += item.engagement;
      if (item.score > entry.bestScore) {
        entry.bestScore = item.score;
        entry.bestPlatform = item.platform;
      }
    });

    // Calculate average scores
    const results = Array.from(contentMap.values()).map(entry => {
      entry.avgScore = entry.platforms.reduce((sum, p) => sum + p.score, 0) / entry.platforms.length;
      return entry;
    });

    // Sort by score
    results.sort((a, b) => b.avgScore - a.avgScore);

    logger.info('Evergreen content detected', { userId, count: results.length });
    return results;
  } catch (error) {
    logger.error('Error detecting evergreen content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate evergreen score
 */
function calculateEvergreenScore(post, engagement, engagementRate, minEngagement, minEngagementRate, timeDecay) {
  // Base score from engagement
  const engagementScore = Math.min(engagement / (minEngagement * 2), 1) * 0.4;

  // Engagement rate score
  const rateScore = Math.min(engagementRate / (minEngagementRate * 2), 1) * 0.3;

  // Time decay (older posts get slight penalty, but evergreen should maintain)
  const daysSincePost = (new Date() - new Date(post.postedAt)) / (1000 * 60 * 60 * 24);
  const timeScore = Math.max(0, 1 - (daysSincePost * timeDecay / 100)) * 0.2;

  // Content type score (some types are more evergreen)
  const typeScore = getContentTypeScore(post.contentId?.type || 'post') * 0.1;

  return engagementScore + rateScore + timeScore + typeScore;
}

/**
 * Get content type evergreen score
 */
function getContentTypeScore(type) {
  const scores = {
    'how-to': 0.9,
    'tutorial': 0.9,
    'guide': 0.85,
    'tips': 0.8,
    'list': 0.75,
    'quote': 0.7,
    'post': 0.6,
    'news': 0.3,
    'trending': 0.2
  };
  return scores[type] || 0.6;
}

/**
 * Auto-build recycling calendar per platform
 */
async function buildRecyclingCalendar(userId, evergreenContent, options = {}) {
  try {
    const {
      platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
      frequency = 'monthly', // daily, weekly, biweekly, monthly
      duration = 90, // days
      startDate = new Date()
    } = options;

    const calendar = {
      userId,
      startDate,
      endDate: new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000),
      platforms: {},
      totalPosts: 0
    };

    // Calculate posting frequency
    const frequencyDays = {
      daily: 1,
      weekly: 7,
      biweekly: 14,
      monthly: 30
    };
    const daysBetween = frequencyDays[frequency] || 30;

    for (const platform of platforms) {
      calendar.platforms[platform] = {
        posts: [],
        schedule: []
      };

      // Filter evergreen content for this platform
      const platformContent = evergreenContent.filter(c => 
        c.platforms.some(p => p.platform === platform)
      );

      // Sort by score
      platformContent.sort((a, b) => {
        const aPlatform = a.platforms.find(p => p.platform === platform);
        const bPlatform = b.platforms.find(p => p.platform === platform);
        return (bPlatform?.score || 0) - (aPlatform?.score || 0);
      });

      // Build schedule
      let currentDate = new Date(startDate);
      let contentIndex = 0;

      while (currentDate <= calendar.endDate && platformContent.length > 0) {
        const content = platformContent[contentIndex % platformContent.length];
        const platformData = content.platforms.find(p => p.platform === platform);

        if (platformData) {
          calendar.platforms[platform].schedule.push({
            date: new Date(currentDate),
            contentId: content.contentId,
            originalPostId: platformData.postedAt,
            score: platformData.score,
            engagement: platformData.engagement
          });

          calendar.totalPosts++;
        }

        // Move to next date
        currentDate.setDate(currentDate.getDate() + daysBetween);
        contentIndex++;
      }
    }

    logger.info('Recycling calendar built', { userId, platforms: platforms.length, totalPosts: calendar.totalPosts });
    return calendar;
  } catch (error) {
    logger.error('Error building recycling calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-create recycling plans from calendar
 */
async function createRecyclingPlansFromCalendar(userId, calendar) {
  try {
    const recyclingPlans = [];

    for (const [platform, platformData] of Object.entries(calendar.platforms)) {
      for (const scheduleItem of platformData.schedule) {
        // Check if recycling plan already exists
        const existing = await ContentRecycle.findOne({
          userId,
          originalContentId: scheduleItem.contentId,
          platform,
          status: 'active'
        });

        if (!existing) {
          const recycle = new ContentRecycle({
            userId,
            originalContentId: scheduleItem.contentId,
            platform,
            recycleType: 'scheduled',
            schedule: {
              nextRepost: scheduleItem.date,
              frequency: 'monthly',
              maxReposts: 12
            },
            performanceThresholds: {
              minEngagement: scheduleItem.engagement * 0.7, // 70% of original
              autoPause: true
            },
            metadata: {
              autoGenerated: true,
              calendarGenerated: true,
              originalScore: scheduleItem.score
            }
          });

          await recycle.save();
          recyclingPlans.push(recycle);
        }
      }
    }

    logger.info('Recycling plans created from calendar', { userId, count: recyclingPlans.length });
    return recyclingPlans;
  } catch (error) {
    logger.error('Error creating recycling plans from calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-detect and build recycling calendar
 */
async function autoBuildRecyclingCalendar(userId, options = {}) {
  try {
    // Detect evergreen content
    const evergreenContent = await detectEvergreenContent(userId, options);

    if (evergreenContent.length === 0) {
      return {
        evergreenCount: 0,
        calendar: null,
        plans: []
      };
    }

    // Build calendar
    const calendar = await buildRecyclingCalendar(userId, evergreenContent, options);

    // Create recycling plans
    const plans = await createRecyclingPlansFromCalendar(userId, calendar);

    return {
      evergreenCount: evergreenContent.length,
      calendar,
      plans,
      summary: {
        platforms: Object.keys(calendar.platforms).length,
        totalPosts: calendar.totalPosts,
        plansCreated: plans.length
      }
    };
  } catch (error) {
    logger.error('Error auto-building recycling calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Detect seasonal evergreen content
 */
async function detectSeasonalEvergreen(userId, season = null) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    
    // Determine season if not provided
    if (!season) {
      if (currentMonth >= 2 && currentMonth <= 4) season = 'spring';
      else if (currentMonth >= 5 && currentMonth <= 7) season = 'summer';
      else if (currentMonth >= 8 && currentMonth <= 10) season = 'fall';
      else season = 'winter';
    }

    // Get content posted in same season last year
    const lastYear = new Date(now);
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    
    const seasonMonths = {
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10],
      winter: [11, 0, 1]
    };

    const months = seasonMonths[season] || seasonMonths.spring;
    const startDate = new Date(lastYear.getFullYear(), months[0], 1);
    const endDate = new Date(lastYear.getFullYear(), months[2] + 1, 0);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate, $lte: endDate }
    })
      .populate('contentId')
      .lean();

    const seasonalContent = [];
    for (const post of posts) {
      if (!post.contentId || !post.analytics) continue;

      const engagement = post.analytics.engagement || 0;
      const impressions = post.analytics.impressions || 1;
      const engagementRate = engagement / impressions;

      // Higher weight for seasonal content
      const seasonalScore = calculateEvergreenScore(
        post,
        engagement,
        engagementRate,
        50, // Lower threshold for seasonal
        0.03,
        0.05 // Less time decay for seasonal
      ) * 1.2; // 20% boost for seasonal relevance

      if (seasonalScore >= 0.7) {
        seasonalContent.push({
          contentId: post.contentId._id || post.contentId,
          postId: post._id,
          platform: post.platform,
          score: seasonalScore,
          engagement,
          engagementRate,
          postedAt: post.postedAt,
          season,
          content: post.contentId
        });
      }
    }

    logger.info('Seasonal evergreen content detected', { userId, season, count: seasonalContent.length });
    return seasonalContent;
  } catch (error) {
    logger.error('Error detecting seasonal evergreen', { error: error.message, userId });
    throw error;
  }
}

/**
 * Predict if content will become evergreen
 */
async function predictEvergreenPotential(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Get initial performance
    const posts = await ScheduledPost.find({
      userId,
      contentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(5)
      .lean();

    if (posts.length === 0) {
      return {
        potential: 'unknown',
        score: 0,
        confidence: 0,
        factors: []
      };
    }

    const factors = {
      consistency: 0,
      engagementTrend: 0,
      contentType: 0,
      platformDiversity: 0
    };

    // Consistency (low variance in engagement)
    const engagements = posts.map(p => p.analytics?.engagement || 0);
    const avgEngagement = engagements.reduce((a, b) => a + b, 0) / engagements.length;
    const variance = engagements.reduce((sum, e) => sum + Math.pow(e - avgEngagement, 2), 0) / engagements.length;
    const stdDev = Math.sqrt(variance);
    factors.consistency = Math.max(0, 1 - (stdDev / avgEngagement)) * 0.3;

    // Engagement trend (increasing or stable)
    if (engagements.length >= 2) {
      const trend = (engagements[0] - engagements[engagements.length - 1]) / engagements[engagements.length - 1];
      factors.engagementTrend = Math.max(0, trend + 0.5) * 0.3;
    }

    // Content type
    factors.contentType = getContentTypeScore(content.type || 'post') * 0.2;

    // Platform diversity
    const platforms = new Set(posts.map(p => p.platform));
    factors.platformDiversity = Math.min(platforms.size / 6, 1) * 0.2;

    const totalScore = Object.values(factors).reduce((a, b) => a + b, 0);
    const potential = totalScore >= 0.7 ? 'high' : totalScore >= 0.5 ? 'medium' : 'low';
    const confidence = Math.min(posts.length / 5, 1);

    return {
      potential,
      score: totalScore,
      confidence,
      factors: Object.entries(factors).map(([key, value]) => ({
        factor: key,
        score: value,
        contribution: `${(value / totalScore * 100).toFixed(1)}%`
      }))
    };
  } catch (error) {
    logger.error('Error predicting evergreen potential', { error: error.message, userId });
    throw error;
  }
}

/**
 * Optimize recycling calendar (avoid conflicts, optimize timing)
 */
async function optimizeRecyclingCalendar(userId, calendar) {
  try {
    const optimized = JSON.parse(JSON.stringify(calendar));
    
    // Check for conflicts (same content too close together)
    for (const [platform, platformData] of Object.entries(optimized.platforms)) {
      const schedule = platformData.schedule;
      
      // Sort by date
      schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Check for conflicts (same content within 7 days)
      const conflicts = [];
      for (let i = 0; i < schedule.length - 1; i++) {
        const current = schedule[i];
        const next = schedule[i + 1];
        
        if (current.contentId.toString() === next.contentId.toString()) {
          const daysDiff = (new Date(next.date) - new Date(current.date)) / (1000 * 60 * 60 * 24);
          if (daysDiff < 7) {
            conflicts.push({ index: i + 1, daysDiff });
          }
        }
      }
      
      // Resolve conflicts by moving posts
      for (const conflict of conflicts) {
        const item = schedule[conflict.index];
        const newDate = new Date(item.date);
        newDate.setDate(newDate.getDate() + (7 - conflict.daysDiff));
        item.date = newDate;
        item.conflictResolved = true;
      }
      
      // Optimize timing using optimal time prediction
      const { predictOptimalTime } = require('./smartScheduleOptimizationService');
      for (const item of schedule) {
        try {
          const optimal = await predictOptimalTime(userId, platform, 'UTC');
          if (optimal.optimalTime) {
            const optimalDate = new Date(item.date);
            optimalDate.setHours(optimal.optimalTime.getHours());
            optimalDate.setMinutes(optimal.optimalTime.getMinutes());
            item.optimizedTime = optimalDate;
            item.originalTime = item.date;
            item.date = optimalDate;
          }
        } catch (error) {
          // Continue if optimization fails
        }
      }
    }
    
    logger.info('Recycling calendar optimized', { userId, conflictsResolved: conflicts.length });
    return optimized;
  } catch (error) {
    logger.error('Error optimizing recycling calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate content freshness score
 */
async function calculateContentFreshness(contentId, lastPostedDate) {
  try {
    const now = new Date();
    const daysSincePost = (now - new Date(lastPostedDate)) / (1000 * 60 * 60 * 24);
    
    // Freshness decreases over time, but slower for evergreen
    const freshnessScore = Math.max(0, 1 - (daysSincePost / 365));
    
    // Get content performance to adjust
    const posts = await ScheduledPost.find({
      contentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(5)
      .lean();
    
    const avgEngagement = posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / posts.length
      : 0;
    
    // High-performing content stays fresh longer
    const performanceBoost = Math.min(avgEngagement / 1000, 0.3);
    const adjustedFreshness = Math.min(1, freshnessScore + performanceBoost);
    
    return {
      score: adjustedFreshness,
      daysSincePost,
      needsRefresh: adjustedFreshness < 0.5,
      recommendation: adjustedFreshness < 0.5
        ? 'Consider refreshing content (new headline, updated stats, etc.)'
        : 'Content is still fresh'
    };
  } catch (error) {
    logger.error('Error calculating content freshness', { error: error.message });
    return { score: 0.5, daysSincePost: 0, needsRefresh: false };
  }
}

module.exports = {
  detectEvergreenContent,
  buildRecyclingCalendar,
  createRecyclingPlansFromCalendar,
  autoBuildRecyclingCalendar,
  detectSeasonalEvergreen,
  predictEvergreenPotential,
  optimizeRecyclingCalendar,
  calculateContentFreshness
};

