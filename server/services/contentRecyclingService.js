// Content Recycling Service
// Identifies high-performing content and manages auto-reposting

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentRecycle = require('../models/ContentRecycle');
const { getOptimalPostingTimes } = require('./contentCalendarService');
const logger = require('../utils/logger');

/**
 * Identify high-performing content for recycling
 */
async function identifyRecyclableContent(userId, options = {}) {
  try {
    const {
      minEngagement = 100,
      minEngagementRate = 2.0,
      daysSincePost = 7,
      platforms = null,
      limit = 20
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSincePost);

    // Get posted content with good performance
    const query = {
      userId,
      status: 'posted',
      postedAt: { $lte: cutoffDate },
      'analytics.engagement': { $gte: minEngagement }
    };

    if (platforms && platforms.length > 0) {
      query.platform = { $in: platforms };
    }

    const posts = await ScheduledPost.find(query)
      .populate('content.contentId')
      .sort({ 'analytics.engagement': -1 })
      .limit(limit)
      .lean();

    // Calculate engagement rates and filter
    const recyclable = posts
      .map(post => {
        const engagement = post.analytics?.engagement || 0;
        const impressions = post.analytics?.impressions || post.analytics?.views || 1;
        const engagementRate = (engagement / impressions) * 100;

        return {
          postId: post._id,
          contentId: post.content?.contentId?._id || post.contentId,
          platform: post.platform,
          title: post.content?.contentId?.title || post.content?.text || 'Untitled',
          engagement,
          impressions,
          engagementRate,
          postedAt: post.postedAt,
          content: post.content
        };
      })
      .filter(item => item.engagementRate >= minEngagementRate)
      .sort((a, b) => b.engagement - a.engagement);

    // Check if already recycled
    const recycledPostIds = await ContentRecycle.distinct('originalPostId', {
      userId,
      status: 'active'
    });

    const notYetRecycled = recyclable.filter(
      item => !recycledPostIds.includes(item.postId)
    );

    return notYetRecycled;
  } catch (error) {
    logger.error('Error identifying recyclable content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Detect evergreen content
 */
async function detectEvergreenContent(userId, contentId) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      'content.contentId': contentId,
      status: 'posted'
    })
    .sort({ postedAt: -1 })
    .limit(10)
    .lean();

    if (posts.length < 2) {
      return { isEvergreen: false, score: 0 };
    }

    // Calculate consistency score
    const engagements = posts.map(p => p.analytics?.engagement || 0);
    const avgEngagement = engagements.reduce((a, b) => a + b, 0) / engagements.length;
    const variance = engagements.reduce((sum, val) => sum + Math.pow(val - avgEngagement, 2), 0) / engagements.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgEngagement > 0 ? stdDev / avgEngagement : 1;

    // Lower variance = more evergreen
    const consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 100));

    // Check time span
    const timeSpan = (new Date(posts[0].postedAt) - new Date(posts[posts.length - 1].postedAt)) / (1000 * 60 * 60 * 24);
    const timeScore = Math.min(100, (timeSpan / 365) * 100);

    // Check engagement trend
    const recentAvg = engagements.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, engagements.length);
    const olderAvg = engagements.slice(3).reduce((a, b) => a + b, 0) / Math.max(1, engagements.length - 3);
    const trendScore = recentAvg >= olderAvg ? 100 : Math.max(0, (recentAvg / olderAvg) * 100);

    const evergreenScore = (consistencyScore * 0.4) + (timeScore * 0.3) + (trendScore * 0.3);
    const isEvergreen = evergreenScore >= 60;

    return {
      isEvergreen,
      score: Math.round(evergreenScore),
      metrics: {
        consistencyScore: Math.round(consistencyScore),
        timeScore: Math.round(timeScore),
        trendScore: Math.round(trendScore)
      }
    };
  } catch (error) {
    logger.error('Error detecting evergreen content', { error: error.message, userId, contentId });
    return { isEvergreen: false, score: 0 };
  }
}

/**
 * Create recycling plan for content
 */
async function createRecyclingPlan(userId, postId, options = {}) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('content.contentId')
      .lean();

    if (!post || post.userId.toString() !== userId.toString()) {
      throw new Error('Post not found or unauthorized');
    }

    // Check if already recycled
    const existing = await ContentRecycle.findOne({
      userId,
      originalPostId: postId,
      status: 'active'
    });

    if (existing) {
      throw new Error('Content is already being recycled');
    }

    // Detect if evergreen
    const evergreen = await detectEvergreenContent(userId, post.content?.contentId?._id || post.contentId);

    // Get optimal posting time
    const optimalTimes = await getOptimalPostingTimes(userId, [post.platform]);
    const nextOptimalTime = optimalTimes[post.platform]?.[0] || '09:00';

    // Calculate next repost date
    const {
      frequency = 'monthly',
      interval = 30,
      maxReposts = 5
    } = options.repostSchedule || {};

    const nextRepostDate = calculateNextRepostDate(frequency, interval);

    // Create recycling plan
    const recycle = new ContentRecycle({
      originalContentId: post.content?.contentId?._id || post.contentId,
      originalPostId: postId,
      userId,
      platform: post.platform,
      recycleType: options.recycleType || 'exact',
      originalPerformance: {
        engagement: post.analytics?.engagement || 0,
        views: post.analytics?.views || post.analytics?.impressions || 0,
        clicks: post.analytics?.clicks || 0,
        impressions: post.analytics?.impressions || post.analytics?.views || 0,
        engagementRate: post.analytics?.engagementRate || 0,
        postedAt: post.postedAt
      },
      repostSchedule: {
        frequency,
        interval,
        maxReposts,
        currentRepostCount: 0,
        nextRepostDate,
        isActive: true
      },
      refreshOptions: options.refreshOptions || {
        updateHashtags: true,
        updateTiming: true,
        updateCaption: false,
        addNewElements: false
      },
      isEvergreen: evergreen.isEvergreen,
      evergreenScore: evergreen.score,
      status: 'active'
    });

    await recycle.save();

    // Schedule first repost if auto-schedule is enabled
    if (options.autoSchedule !== false) {
      await scheduleNextRepost(recycle._id);
    }

    logger.info('Recycling plan created', { recycleId: recycle._id, userId, postId });
    return recycle;
  } catch (error) {
    logger.error('Error creating recycling plan', { error: error.message, userId, postId });
    throw error;
  }
}

/**
 * Schedule next repost
 */
async function scheduleNextRepost(recycleId) {
  try {
    const recycle = await ContentRecycle.findById(recycleId)
      .populate('originalContentId', 'title type transcript description')
      .populate('originalPostId', 'content platform analytics');

    if (!recycle || recycle.status !== 'active') {
      throw new Error('Recycling plan not found or inactive');
    }

    if (recycle.repostSchedule.currentRepostCount >= recycle.repostSchedule.maxReposts) {
      recycle.status = 'completed';
      await recycle.save();
      return null;
    }

    let nextDate = recycle.repostSchedule.nextRepostDate;
    if (!nextDate || new Date(nextDate) < new Date()) {
      // Calculate new date
      nextDate = calculateNextRepostDate(
        recycle.repostSchedule.frequency,
        recycle.repostSchedule.interval
      );
      recycle.repostSchedule.nextRepostDate = nextDate;
    }

    // Optimize timing using audience insights
    let scheduledTime;
    try {
      const timing = await optimizeRepostTiming(recycle.userId, recycleId, recycle.platform);
      scheduledTime = timing.optimizedTime;
      
      // Ensure scheduled time is after nextDate
      if (scheduledTime < nextDate) {
        scheduledTime = new Date(nextDate);
        scheduledTime.setHours(scheduledTime.getHours() + 1, 0, 0, 0);
      }
    } catch (error) {
      logger.warn('Error optimizing timing, using fallback', { error: error.message });
      // Fallback to original method
      const optimalTimes = await getOptimalPostingTimes(recycle.userId, [recycle.platform]);
      const [hour, minute] = (optimalTimes[recycle.platform]?.[0] || '09:00').split(':').map(Number);
      scheduledTime = new Date(nextDate);
      scheduledTime.setHours(hour, minute, 0, 0);
    }

    // Apply advanced refresh strategy
    let content;
    try {
      const refreshStrategy = recycle.refreshOptions?.strategy || 'smart';
      const refresh = await applyAdvancedRefreshStrategy(recycleId, refreshStrategy);
      
      const Content = require('../models/Content');
      const originalContent = await Content.findById(recycle.originalContentId._id).lean();
      
      content = {
        title: refresh.title || originalContent?.title || 'Recycled Content',
        description: refresh.description || originalContent?.description || '',
        caption: refresh.caption || originalContent?.description || '',
        type: originalContent?.type || 'article',
        hashtags: refresh.hashtags || originalContent?.tags || [],
        refreshChanges: {
          title: refresh.title !== originalContent?.title,
          description: refresh.description !== originalContent?.description,
          caption: !!refresh.caption,
          hashtags: refresh.hashtags && refresh.hashtags.length > 0,
          strategy: refreshStrategy
        }
      };
    } catch (error) {
      logger.warn('Error applying refresh strategy, using fallback', { error: error.message });
      // Fallback to original method
      content = await prepareRecycledContent(recycle, recycle.originalPostId);
    }

    // Create scheduled post
    const scheduledPost = new ScheduledPost({
      userId: recycle.userId,
      contentId: recycle.originalContentId._id,
      platform: recycle.platform,
      content: content,
      scheduledTime,
      status: 'scheduled'
    });
    
    // Store recycling metadata in content field
    if (!scheduledPost.content) {
      scheduledPost.content = {};
    }
    scheduledPost.content.isRecycled = true;
    scheduledPost.content.originalPostId = recycle.originalPostId.toString();

    await scheduledPost.save();

    // Update recycle record
    recycle.reposts.push({
      postId: scheduledPost._id,
      scheduledTime,
      performance: {},
      refreshChanges: content.refreshChanges || {}
    });

    recycle.repostSchedule.currentRepostCount += 1;
    recycle.repostSchedule.nextRepostDate = calculateNextRepostDate(
      recycle.repostSchedule.frequency,
      recycle.repostSchedule.interval,
      scheduledTime
    );

    await recycle.save();

    logger.info('Next repost scheduled', { recycleId, postId: scheduledPost._id });
    return scheduledPost;
  } catch (error) {
    logger.error('Error scheduling next repost', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Prepare recycled content with refresh options
 */
async function prepareRecycledContent(recycle, originalPost) {
  try {
    const content = { ...originalPost.content };
    const refreshChanges = {};

    // Update hashtags if enabled
    if (recycle.refreshOptions.updateHashtags) {
      try {
        const { generateHashtags } = require('./hashtagService');
        const hashtagResult = await generateHashtags(
          content.text || content.caption || '',
          { platform: recycle.platform, count: 10 }
        );
        if (hashtagResult && Array.isArray(hashtagResult) && hashtagResult.length > 0) {
          // Extract hashtag strings from result
          const hashtags = hashtagResult.map(h => 
            typeof h === 'string' ? h : h.hashtag || h
          ).filter(Boolean);
          if (hashtags.length > 0) {
            content.hashtags = hashtags;
            refreshChanges.hashtags = hashtags;
          }
        }
      } catch (error) {
        logger.warn('Error generating hashtags for recycle', { error: error.message });
        // Keep existing hashtags as fallback
      }
    }

    // Update caption if enabled
    if (recycle.refreshOptions.updateCaption) {
      const { adaptContent } = require('./contentAdaptationService');
      const adapted = await adaptContent(
        recycle.userId,
        recycle.originalContentId._id,
        content.text || content.caption || '',
        recycle.originalContentId.title || '',
        [recycle.platform]
      );
      if (adapted.adaptations && adapted.adaptations.length > 0) {
        const platformAdaptation = adapted.adaptations.find(a => a.platform === recycle.platform);
        if (platformAdaptation) {
          content.text = platformAdaptation.content;
          content.caption = platformAdaptation.content;
          refreshChanges.caption = platformAdaptation.content;
        }
      }
    }

    content.refreshChanges = refreshChanges;
    return content;
  } catch (error) {
    logger.error('Error preparing recycled content', { error: error.message });
    return originalPost.content;
  }
}

/**
 * Calculate next repost date
 */
function calculateNextRepostDate(frequency, interval, fromDate = new Date()) {
  const nextDate = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + (interval * 3));
      break;
    case 'custom':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    default:
      nextDate.setDate(nextDate.getDate() + 30);
  }

  return nextDate;
}

/**
 * Update repost performance
 */
async function updateRepostPerformance(recycleId, postId, performance) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const repost = recycle.reposts.find(r => r.postId.toString() === postId.toString());
    if (repost) {
      repost.performance = {
        engagement: performance.engagement || 0,
        views: performance.views || performance.impressions || 0,
        clicks: performance.clicks || 0,
        impressions: performance.impressions || performance.views || 0,
        engagementRate: performance.engagementRate || 0
      };
      repost.postedAt = new Date();

      // Update overall repost performance (average)
      const allReposts = recycle.reposts.filter(r => r.performance);
      if (allReposts.length > 0) {
        recycle.repostPerformance = {
          engagement: Math.round(
            allReposts.reduce((sum, r) => sum + (r.performance.engagement || 0), 0) / allReposts.length
          ),
          views: Math.round(
            allReposts.reduce((sum, r) => sum + (r.performance.views || 0), 0) / allReposts.length
          ),
          clicks: Math.round(
            allReposts.reduce((sum, r) => sum + (r.performance.clicks || 0), 0) / allReposts.length
          ),
          impressions: Math.round(
            allReposts.reduce((sum, r) => sum + (r.performance.impressions || 0), 0) / allReposts.length
          ),
          engagementRate: 
            allReposts.reduce((sum, r) => sum + (r.performance.engagementRate || 0), 0) / allReposts.length
        };
      }
    }

    await recycle.save();
    logger.info('Repost performance updated', { recycleId, postId });
    return recycle;
  } catch (error) {
    logger.error('Error updating repost performance', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Get recycling statistics
 */
async function getRecyclingStats(userId) {
  try {
    const recycles = await ContentRecycle.find({ userId }).lean();

    const stats = {
      totalRecycled: recycles.length,
      active: recycles.filter(r => r.status === 'active').length,
      completed: recycles.filter(r => r.status === 'completed').length,
      totalReposts: recycles.reduce((sum, r) => sum + r.repostSchedule.currentRepostCount, 0),
      averagePerformanceChange: 0,
      evergreenContent: recycles.filter(r => r.isEvergreen).length,
      byPlatform: {},
      topPerformers: []
    };

    // Calculate average performance change
    const withPerformance = recycles.filter(r => r.originalPerformance && r.repostPerformance);
    if (withPerformance.length > 0) {
      const changes = withPerformance.map(r => {
        const original = r.originalPerformance.engagement || 0;
        const repost = r.repostPerformance.engagement || 0;
        return original > 0 ? ((repost - original) / original) * 100 : 0;
      });
      stats.averagePerformanceChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    // Group by platform
    recycles.forEach(recycle => {
      if (!stats.byPlatform[recycle.platform]) {
        stats.byPlatform[recycle.platform] = {
          count: 0,
          reposts: 0
        };
      }
      stats.byPlatform[recycle.platform].count++;
      stats.byPlatform[recycle.platform].reposts += recycle.repostSchedule.currentRepostCount;
    });

    // Top performers
    stats.topPerformers = recycles
      .filter(r => r.repostPerformance?.engagement)
      .sort((a, b) => (b.repostPerformance.engagement || 0) - (a.repostPerformance.engagement || 0))
      .slice(0, 5)
      .map(r => ({
        recycleId: r._id,
        contentId: r.originalContentId,
        platform: r.platform,
        engagement: r.repostPerformance.engagement
      }));

    return stats;
  } catch (error) {
    logger.error('Error getting recycling stats', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-detect and suggest recyclable content
 */
async function suggestRecyclableContent(userId, limit = 10) {
  try {
    const recyclable = await identifyRecyclableContent(userId, {
      minEngagement: 50,
      minEngagementRate: 1.5,
      daysSincePost: 7,
      limit
    });

    // Enhance with evergreen detection
    const suggestions = await Promise.all(
      recyclable.map(async (item) => {
        const evergreen = await detectEvergreenContent(userId, item.contentId);
        return {
          ...item,
          isEvergreen: evergreen.isEvergreen,
          evergreenScore: evergreen.score,
          recommendation: evergreen.isEvergreen 
            ? 'High evergreen potential - great for recycling'
            : evergreen.score > 40
            ? 'Moderate evergreen potential'
            : 'Good performance - consider recycling'
        };
      })
    );

    return suggestions.sort((a, b) => {
      // Sort by evergreen score first, then engagement
      if (a.isEvergreen !== b.isEvergreen) {
        return b.isEvergreen ? 1 : -1;
      }
      return (b.evergreenScore || 0) - (a.evergreenScore || 0);
    });
  } catch (error) {
    logger.error('Error suggesting recyclable content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Pause/Resume recycling
 */
async function toggleRecycling(recycleId, userId, isActive) {
  try {
    const recycle = await ContentRecycle.findOne({
      _id: recycleId,
      userId
    });

    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    recycle.repostSchedule.isActive = isActive;
    recycle.status = isActive ? 'active' : 'paused';

    await recycle.save();
    logger.info('Recycling toggled', { recycleId, isActive });
    return recycle;
  } catch (error) {
    logger.error('Error toggling recycling', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Detect content decay
 */
async function detectContentDecay(recycleId) {
  try {
    const recycle = await ContentRecycle.findById(recycleId)
      .populate('reposts.postId')
      .lean();

    if (!recycle || recycle.reposts.length < 2) {
      return { decayDetected: false, decayScore: 0 };
    }

    // Get performance trend
    const performances = recycle.reposts
      .filter(r => r.performance && r.performance.engagement)
      .map(r => r.performance.engagement)
      .reverse(); // Most recent first

    if (performances.length < 2) {
      return { decayDetected: false, decayScore: 0 };
    }

    // Calculate trend
    const recentAvg = performances.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const olderAvg = performances.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, performances.length - 2);
    const originalEngagement = recycle.originalPerformance?.engagement || 0;

    // Decay indicators
    const recentVsOriginal = originalEngagement > 0 ? (recentAvg / originalEngagement) : 1;
    const recentVsOlder = olderAvg > 0 ? (recentAvg / olderAvg) : 1;

    const decayScore = Math.max(0, 100 - (recentVsOriginal * 50) - (recentVsOlder * 50));
    const decayDetected = decayScore > 40 || recentVsOriginal < 0.6;

    // Update recycle record
    await ContentRecycle.findByIdAndUpdate(recycleId, {
      decayDetected,
      performanceTrend: recentVsOlder < 0.9 ? 'declining' : recentVsOlder > 1.1 ? 'improving' : 'stable'
    });

    return {
      decayDetected,
      decayScore: Math.round(decayScore),
      recentVsOriginal: Math.round(recentVsOriginal * 100) / 100,
      recentVsOlder: Math.round(recentVsOlder * 100) / 100,
      recommendation: decayDetected
        ? 'Consider pausing recycling or refreshing content significantly'
        : 'Content performing well, continue recycling'
    };
  } catch (error) {
    logger.error('Error detecting content decay', { error: error.message, recycleId });
    return { decayDetected: false, decayScore: 0 };
  }
}

/**
 * Auto-adjust recycling based on performance
 */
async function autoAdjustRecycling(recycleId) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle || !recycle.autoAdjustment?.enabled) {
      return null;
    }

    const threshold = recycle.autoAdjustment.minPerformanceThreshold;
    const originalEngagement = recycle.originalPerformance?.engagement || 0;
    const recentPerformance = recycle.repostPerformance?.engagement || 0;

    if (originalEngagement === 0) {
      return null;
    }

    const performanceRatio = recentPerformance / originalEngagement;

    if (performanceRatio < threshold) {
      const strategy = recycle.autoAdjustment.adjustmentStrategy;

      if (strategy === 'frequency') {
        // Increase interval (post less frequently)
        const currentInterval = recycle.repostSchedule.interval;
        recycle.repostSchedule.interval = Math.min(currentInterval * 1.5, 90); // Max 90 days
        logger.info('Auto-adjusted recycling frequency', { recycleId, newInterval: recycle.repostSchedule.interval });
      } else if (strategy === 'refresh') {
        // Enable more refresh options
        recycle.refreshOptions.updateCaption = true;
        recycle.refreshOptions.generateVariations = true;
        logger.info('Auto-enabled content refresh', { recycleId });
      } else if (strategy === 'pause') {
        // Pause recycling
        recycle.repostSchedule.isActive = false;
        recycle.status = 'paused';
        logger.info('Auto-paused recycling due to poor performance', { recycleId });
      }

      await recycle.save();
      return { adjusted: true, strategy, action: strategy };
    }

    return { adjusted: false };
  } catch (error) {
    logger.error('Error auto-adjusting recycling', { error: error.message, recycleId });
    return null;
  }
}

/**
 * Bulk create recycling plans
 */
async function bulkCreateRecyclingPlans(userId, postIds, templateId = null) {
  try {
    const results = {
      created: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    let template = null;
    if (templateId) {
      const RecyclingTemplate = require('../models/RecyclingTemplate');
      template = await RecyclingTemplate.findById(templateId);
      if (template && template.userId.toString() !== userId.toString()) {
        throw new Error('Template not found or unauthorized');
      }
    }

    for (const postId of postIds) {
      try {
        // Check if already recycled
        const existing = await ContentRecycle.findOne({
          userId,
          originalPostId: postId,
          status: { $in: ['active', 'paused'] }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Use template options if available
        const options = template ? {
          repostSchedule: template.repostSchedule,
          refreshOptions: template.refreshOptions,
          autoAdjustment: template.autoAdjustment
        } : {};

        await createRecyclingPlan(userId, postId, options);
        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({ postId, error: error.message });
        logger.error('Error creating bulk recycling plan', { postId, error: error.message });
      }
    }

    // Update template usage count
    if (template) {
      template.usageCount = (template.usageCount || 0) + results.created;
      await template.save();
    }

    return results;
  } catch (error) {
    logger.error('Error bulk creating recycling plans', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get advanced recycling analytics
 */
async function getAdvancedAnalytics(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const recycles = await ContentRecycle.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const analytics = {
      overview: {
        totalRecycled: recycles.length,
        active: recycles.filter(r => r.status === 'active').length,
        paused: recycles.filter(r => r.status === 'paused').length,
        completed: recycles.filter(r => r.status === 'completed').length,
        totalReposts: recycles.reduce((sum, r) => sum + (r.repostSchedule?.currentRepostCount || 0), 0)
      },
      performance: {
        averageOriginalEngagement: 0,
        averageRepostEngagement: 0,
        averagePerformanceChange: 0,
        bestPerformer: null,
        worstPerformer: null
      },
      trends: {
        improving: recycles.filter(r => r.performanceTrend === 'improving').length,
        stable: recycles.filter(r => r.performanceTrend === 'stable').length,
        declining: recycles.filter(r => r.performanceTrend === 'declining').length,
        decayDetected: recycles.filter(r => r.decayDetected).length
      },
      platformBreakdown: {},
      evergreen: {
        total: recycles.filter(r => r.isEvergreen).length,
        averageScore: 0
      },
      autoAdjustments: {
        total: 0,
        byStrategy: {}
      }
    };

    // Calculate performance metrics
    const withPerformance = recycles.filter(r => r.originalPerformance && r.repostPerformance);
    if (withPerformance.length > 0) {
      analytics.performance.averageOriginalEngagement = Math.round(
        withPerformance.reduce((sum, r) => sum + (r.originalPerformance.engagement || 0), 0) / withPerformance.length
      );
      analytics.performance.averageRepostEngagement = Math.round(
        withPerformance.reduce((sum, r) => sum + (r.repostPerformance.engagement || 0), 0) / withPerformance.length
      );
      analytics.performance.averagePerformanceChange = 
        withPerformance.reduce((sum, r) => {
          const original = r.originalPerformance.engagement || 0;
          const repost = r.repostPerformance.engagement || 0;
          return sum + (original > 0 ? ((repost - original) / original) * 100 : 0);
        }, 0) / withPerformance.length;

      // Best and worst performers
      const sorted = [...withPerformance].sort((a, b) => {
        const aChange = ((a.repostPerformance.engagement - a.originalPerformance.engagement) / a.originalPerformance.engagement) * 100;
        const bChange = ((b.repostPerformance.engagement - b.originalPerformance.engagement) / b.originalPerformance.engagement) * 100;
        return bChange - aChange;
      });

      if (sorted.length > 0) {
        analytics.performance.bestPerformer = {
          recycleId: sorted[0]._id,
          change: Math.round(((sorted[0].repostPerformance.engagement - sorted[0].originalPerformance.engagement) / sorted[0].originalPerformance.engagement) * 100)
        };
        analytics.performance.worstPerformer = {
          recycleId: sorted[sorted.length - 1]._id,
          change: Math.round(((sorted[sorted.length - 1].repostPerformance.engagement - sorted[sorted.length - 1].originalPerformance.engagement) / sorted[sorted.length - 1].originalPerformance.engagement) * 100)
        };
      }
    }

    // Platform breakdown
    recycles.forEach(recycle => {
      if (!analytics.platformBreakdown[recycle.platform]) {
        analytics.platformBreakdown[recycle.platform] = {
          count: 0,
          totalReposts: 0,
          averageEngagement: 0
        };
      }
      analytics.platformBreakdown[recycle.platform].count++;
      analytics.platformBreakdown[recycle.platform].totalReposts += recycle.repostSchedule?.currentRepostCount || 0;
    });

    // Evergreen average score
    const evergreenRecycles = recycles.filter(r => r.isEvergreen);
    if (evergreenRecycles.length > 0) {
      analytics.evergreen.averageScore = Math.round(
        evergreenRecycles.reduce((sum, r) => sum + (r.evergreenScore || 0), 0) / evergreenRecycles.length
      );
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting advanced analytics', { error: error.message, userId });
    throw error;
  }
}

/**
 * Optimize repost timing using audience insights
 */
async function optimizeRepostTiming(userId, recycleId, platform) {
  try {
    const { getAudienceInsights } = require('./advancedAudienceInsightsService');
    const { getOptimalPostingTimes } = require('./contentPerformanceService');
    
    // Get audience insights for optimal timing
    const insights = await getAudienceInsights(userId, { period: 30, platform });
    
    // Get optimal posting times
    let optimalTimes = null;
    try {
      optimalTimes = await getOptimalPostingTimes(userId, platform);
    } catch (error) {
      logger.warn('Error getting optimal times', { error: error.message });
    }

    // Determine best time
    let bestTime = null;
    
    if (optimalTimes && optimalTimes.bestHours && optimalTimes.bestHours.length > 0) {
      // Use optimal hours from performance data
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Find next optimal hour
      const currentHour = now.getHours();
      const optimalHour = optimalTimes.bestHours.find(h => h > currentHour) || optimalTimes.bestHours[0];
      
      bestTime = new Date(today);
      bestTime.setHours(optimalHour, 0, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (bestTime <= now) {
        bestTime.setDate(bestTime.getDate() + 1);
      }
    } else if (insights.hasData && insights.insights.demographics.peakHours.length > 0) {
      // Use peak hours from audience insights
      const peakHour = insights.insights.demographics.peakHours[0].hour;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      bestTime = new Date(today);
      bestTime.setHours(peakHour, 0, 0, 0);
      
      if (bestTime <= now) {
        bestTime.setDate(bestTime.getDate() + 1);
      }
    } else {
      // Default: schedule for tomorrow at 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      bestTime = tomorrow;
    }

    return {
      optimizedTime: bestTime,
      source: optimalTimes ? 'performance' : insights.hasData ? 'audience' : 'default',
      confidence: optimalTimes ? 'high' : insights.hasData ? 'medium' : 'low'
    };
  } catch (error) {
    logger.error('Error optimizing repost timing', { error: error.message, userId, recycleId });
    // Return default time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return {
      optimizedTime: tomorrow,
      source: 'default',
      confidence: 'low'
    };
  }
}

/**
 * Advanced content refresh strategies
 */
async function applyAdvancedRefreshStrategy(recycleId, strategy = 'smart') {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const Content = require('../models/Content');
    const originalContent = await Content.findById(recycle.originalContentId).lean();

    if (!originalContent) {
      throw new Error('Original content not found');
    }

    const refresh = {
      title: originalContent.title,
      description: originalContent.description,
      tags: originalContent.tags || [],
      hashtags: [],
      caption: null
    };

    switch (strategy) {
      case 'minimal':
        // Just update hashtags
        refresh.hashtags = await generateFreshHashtags(originalContent);
        break;

      case 'moderate':
        // Update hashtags and caption
        refresh.hashtags = await generateFreshHashtags(originalContent);
        refresh.caption = await generateRefreshedCaption(originalContent);
        break;

      case 'aggressive':
        // Full refresh: title, description, hashtags, caption
        refresh.title = await generateRefreshedTitle(originalContent);
        refresh.description = await generateRefreshedDescription(originalContent);
        refresh.hashtags = await generateFreshHashtags(originalContent);
        refresh.caption = await generateRefreshedCaption(originalContent);
        break;

      case 'smart':
      default:
        // Smart refresh based on performance
        const performanceRatio = recycle.repostPerformance?.engagement 
          ? (recycle.repostPerformance.engagement / (recycle.originalPerformance?.engagement || 1))
          : 1;

        if (performanceRatio < 0.7) {
          // Poor performance: aggressive refresh
          refresh.title = await generateRefreshedTitle(originalContent);
          refresh.description = await generateRefreshedDescription(originalContent);
          refresh.hashtags = await generateFreshHashtags(originalContent);
          refresh.caption = await generateRefreshedCaption(originalContent);
        } else if (performanceRatio < 0.9) {
          // Moderate performance: moderate refresh
          refresh.hashtags = await generateFreshHashtags(originalContent);
          refresh.caption = await generateRefreshedCaption(originalContent);
        } else {
          // Good performance: minimal refresh
          refresh.hashtags = await generateFreshHashtags(originalContent);
        }
        break;
    }

    return refresh;
  } catch (error) {
    logger.error('Error applying refresh strategy', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Generate fresh hashtags
 */
async function generateFreshHashtags(content) {
  try {
    const { generateHashtags } = require('./hashtagService');
    const result = await generateHashtags(content.title || content.description || '', {
      count: 5,
      platform: 'all'
    });
    
    if (Array.isArray(result)) {
      return result.map(h => typeof h === 'string' ? h : h.tag || h.text).slice(0, 5);
    }
    
    return content.tags || [];
  } catch (error) {
    logger.warn('Error generating hashtags', { error: error.message });
    return content.tags || [];
  }
}

/**
 * Generate refreshed caption
 */
async function generateRefreshedCaption(content) {
  try {
    const { generateSocialContent } = require('./aiService');
    const prompt = `Create a fresh, engaging caption for reposting this content. Make it different from the original but maintain the core message.

Original: ${content.title || content.description || ''}

Create a new engaging caption (max 200 characters):`;

    const result = await generateSocialContent(prompt, { maxLength: 200 });
    return result || content.description || '';
  } catch (error) {
    logger.warn('Error generating caption', { error: error.message });
    return content.description || '';
  }
}

/**
 * Generate refreshed title
 */
async function generateRefreshedTitle(content) {
  try {
    const { generateSocialContent } = require('./aiService');
    const prompt = `Create a fresh title for reposting this content. Make it different but maintain the core message.

Original: ${content.title || ''}
Description: ${content.description || ''}

Create a new engaging title (max 60 characters):`;

    const result = await generateSocialContent(prompt, { maxLength: 60 });
    return result || content.title || 'Untitled';
  } catch (error) {
    logger.warn('Error generating title', { error: error.message });
    return content.title || 'Untitled';
  }
}

/**
 * Generate refreshed description
 */
async function generateRefreshedDescription(content) {
  try {
    const { generateSocialContent } = require('./aiService');
    const prompt = `Create a fresh description for reposting this content. Make it different but maintain the core message.

Original: ${content.description || content.title || ''}

Create a new engaging description (max 300 characters):`;

    const result = await generateSocialContent(prompt, { maxLength: 300 });
    return result || content.description || '';
  } catch (error) {
    logger.warn('Error generating description', { error: error.message });
    return content.description || '';
  }
}

/**
 * Multi-platform repost optimization
 */
async function optimizeMultiPlatformRepost(userId, recycleId, platforms) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const optimizations = {};

    for (const platform of platforms) {
      // Get platform-specific optimal time
      const timing = await optimizeRepostTiming(userId, recycleId, platform);
      
      // Get platform-specific refresh strategy
      const refresh = await applyAdvancedRefreshStrategy(recycleId, 'smart');
      
      // Platform-specific optimizations
      const platformOptimization = {
        platform,
        scheduledTime: timing.optimizedTime,
        timingConfidence: timing.confidence,
        refreshStrategy: refresh,
        recommended: true
      };

      // Adjust based on platform
      if (platform === 'twitter') {
        platformOptimization.refreshStrategy.caption = refresh.caption?.substring(0, 280) || refresh.caption;
      } else if (platform === 'linkedin') {
        platformOptimization.refreshStrategy.caption = refresh.caption || refresh.description;
      }

      optimizations[platform] = platformOptimization;
    }

    return {
      optimizations,
      totalPlatforms: platforms.length,
      recommendedSchedule: Object.values(optimizations)
        .sort((a, b) => a.scheduledTime - b.scheduledTime)
    };
  } catch (error) {
    logger.error('Error optimizing multi-platform repost', { error: error.message, userId, recycleId });
    throw error;
  }
}

/**
 * Get repost analytics
 */
async function getRepostAnalytics(userId, recycleId = null) {
  try {
    const query = { userId };
    if (recycleId) {
      query._id = recycleId;
    }

    const recycles = await ContentRecycle.find(query).lean();

    const analytics = {
      totalRecycles: recycles.length,
      activeRecycles: recycles.filter(r => r.status === 'active').length,
      totalReposts: recycles.reduce((sum, r) => sum + r.repostSchedule.currentRepostCount, 0),
      performanceComparison: {
        originalTotal: 0,
        repostTotal: 0,
        averageChange: 0
      },
      platformPerformance: {},
      timePerformance: {},
      refreshStrategyPerformance: {},
      topPerformers: [],
      underPerformers: []
    };

    // Calculate performance comparison
    const withPerformance = recycles.filter(r => 
      r.originalPerformance && r.repostPerformance
    );

    if (withPerformance.length > 0) {
      analytics.performanceComparison.originalTotal = withPerformance.reduce(
        (sum, r) => sum + (r.originalPerformance.engagement || 0), 0
      );
      analytics.performanceComparison.repostTotal = withPerformance.reduce(
        (sum, r) => sum + (r.repostPerformance.engagement || 0), 0
      );

      const changes = withPerformance.map(r => {
        const original = r.originalPerformance.engagement || 0;
        const repost = r.repostPerformance.engagement || 0;
        return original > 0 ? ((repost - original) / original) * 100 : 0;
      });

      analytics.performanceComparison.averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    // Platform performance
    recycles.forEach(recycle => {
      if (!analytics.platformPerformance[recycle.platform]) {
        analytics.platformPerformance[recycle.platform] = {
          count: 0,
          avgOriginalEngagement: 0,
          avgRepostEngagement: 0,
          avgChange: 0
        };
      }

      const platformData = analytics.platformPerformance[recycle.platform];
      platformData.count++;

      if (recycle.originalPerformance) {
        platformData.avgOriginalEngagement += recycle.originalPerformance.engagement || 0;
      }
      if (recycle.repostPerformance) {
        platformData.avgRepostEngagement += recycle.repostPerformance.engagement || 0;
      }
    });

    // Calculate averages
    Object.keys(analytics.platformPerformance).forEach(platform => {
      const data = analytics.platformPerformance[platform];
      data.avgOriginalEngagement = Math.round(data.avgOriginalEngagement / data.count);
      data.avgRepostEngagement = Math.round(data.avgRepostEngagement / data.count);
      data.avgChange = data.avgOriginalEngagement > 0
        ? Math.round(((data.avgRepostEngagement / data.avgOriginalEngagement) - 1) * 100 * 10) / 10
        : 0;
    });

    // Top and under performers
    analytics.topPerformers = recycles
      .filter(r => r.repostPerformance?.engagement)
      .sort((a, b) => (b.repostPerformance.engagement || 0) - (a.repostPerformance.engagement || 0))
      .slice(0, 10)
      .map(r => ({
        recycleId: r._id,
        contentId: r.originalContentId,
        platform: r.platform,
        originalEngagement: r.originalPerformance?.engagement || 0,
        repostEngagement: r.repostPerformance?.engagement || 0,
        change: r.originalPerformance?.engagement > 0
          ? ((r.repostPerformance.engagement - r.originalPerformance.engagement) / r.originalPerformance.engagement) * 100
          : 0
      }));

    analytics.underPerformers = recycles
      .filter(r => r.repostPerformance?.engagement && r.originalPerformance?.engagement)
      .filter(r => {
        const change = ((r.repostPerformance.engagement - r.originalPerformance.engagement) / r.originalPerformance.engagement) * 100;
        return change < -20; // 20% or more decline
      })
      .sort((a, b) => {
        const changeA = ((a.repostPerformance.engagement - a.originalPerformance.engagement) / a.originalPerformance.engagement) * 100;
        const changeB = ((b.repostPerformance.engagement - b.originalPerformance.engagement) / b.originalPerformance.engagement) * 100;
        return changeA - changeB;
      })
      .slice(0, 10)
      .map(r => ({
        recycleId: r._id,
        contentId: r.originalContentId,
        platform: r.platform,
        originalEngagement: r.originalPerformance?.engagement || 0,
        repostEngagement: r.repostPerformance?.engagement || 0,
        change: ((r.repostPerformance.engagement - r.originalPerformance.engagement) / r.originalPerformance.engagement) * 100
      }));

    return analytics;
  } catch (error) {
    logger.error('Error getting repost analytics', { error: error.message, userId });
    throw error;
  }
}

/**
 * Smart content variations for reposts
 */
async function generateSmartVariations(recycleId, count = 3) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const Content = require('../models/Content');
    const originalContent = await Content.findById(recycle.originalContentId).lean();

    if (!originalContent) {
      throw new Error('Original content not found');
    }

    const variations = [];

    for (let i = 0; i < count; i++) {
      const variation = {
        title: await generateRefreshedTitle(originalContent),
        description: await generateRefreshedDescription(originalContent),
        caption: await generateRefreshedCaption(originalContent),
        hashtags: await generateFreshHashtags(originalContent),
        variationType: i === 0 ? 'minimal' : i === 1 ? 'moderate' : 'aggressive',
        score: 0
      };

      // Score variation quality
      variation.score = scoreVariation(variation, originalContent);
      variations.push(variation);
    }

    // Sort by score
    variations.sort((a, b) => b.score - a.score);

    return {
      variations,
      recommended: variations[0],
      totalGenerated: variations.length
    };
  } catch (error) {
    logger.error('Error generating smart variations', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Score variation quality
 */
function scoreVariation(variation, original) {
  let score = 0;

  // Title difference (should be different but relevant)
  if (variation.title && variation.title !== original.title) {
    score += 30;
  }

  // Description difference
  if (variation.description && variation.description !== original.description) {
    score += 20;
  }

  // Hashtags freshness
  if (variation.hashtags && variation.hashtags.length > 0) {
    score += 25;
  }

  // Caption quality
  if (variation.caption && variation.caption.length > 50) {
    score += 25;
  }

  return score;
}

/**
 * Predict repost performance
 */
async function predictRepostPerformance(userId, recycleId) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const originalEngagement = recycle.originalPerformance?.engagement || 0;
    const repostCount = recycle.repostSchedule.currentRepostCount;
    const repostPerformance = recycle.repostPerformance?.engagement || 0;

    // Calculate performance trend
    let performanceTrend = 1.0;
    if (repostCount > 0 && originalEngagement > 0) {
      performanceTrend = repostPerformance / originalEngagement;
    }

    // Predict next repost performance
    // Factors: original performance, trend, repost count, time since original
    const daysSinceOriginal = (Date.now() - new Date(recycle.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.max(0.5, 1 - (daysSinceOriginal / 365)); // Decay over 1 year
    
    // Engagement decay per repost
    const repostDecay = Math.max(0.6, 1 - (repostCount * 0.1)); // 10% decay per repost, min 60%

    const predictedEngagement = originalEngagement * performanceTrend * timeDecay * repostDecay;

    // Get audience insights for better prediction
    let audienceFactor = 1.0;
    try {
      const { getAudienceInsights } = require('./advancedAudienceInsightsService');
      const insights = await getAudienceInsights(userId, { period: 30, platform: recycle.platform });
      
      if (insights.hasData && insights.insights.growth.trend === 'growing') {
        audienceFactor = 1.1; // 10% boost for growing audience
      } else if (insights.hasData && insights.insights.growth.trend === 'declining') {
        audienceFactor = 0.9; // 10% reduction for declining audience
      }
    } catch (error) {
      logger.warn('Error getting audience insights for prediction', { error: error.message });
    }

    const finalPrediction = Math.round(predictedEngagement * audienceFactor);

    return {
      predictedEngagement: finalPrediction,
      originalEngagement,
      performanceTrend: Math.round(performanceTrend * 100) / 100,
      timeDecay: Math.round(timeDecay * 100) / 100,
      repostDecay: Math.round(repostDecay * 100) / 100,
      audienceFactor: Math.round(audienceFactor * 100) / 100,
      confidence: repostCount >= 3 ? 'high' : repostCount >= 1 ? 'medium' : 'low',
      factors: {
        originalPerformance: originalEngagement,
        currentTrend: performanceTrend,
        timeSinceOriginal: Math.round(daysSinceOriginal),
        repostCount,
        audienceGrowth: audienceFactor
      },
      recommendation: finalPrediction > originalEngagement * 0.8
        ? 'Good repost potential - predicted performance is strong'
        : finalPrediction > originalEngagement * 0.6
        ? 'Moderate repost potential - consider content refresh'
        : 'Low repost potential - significant refresh recommended'
    };
  } catch (error) {
    logger.error('Error predicting repost performance', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Analyze repost ROI
 */
async function analyzeRepostROI(userId, recycleId = null) {
  try {
    const query = { userId };
    if (recycleId) {
      query._id = recycleId;
    }

    const recycles = await ContentRecycle.find(query).lean();

    if (recycles.length === 0) {
      return {
        hasROI: false,
        message: 'No recycling data available'
      };
    }

    // Calculate ROI metrics
    const roiAnalysis = {
      totalRecycles: recycles.length,
      totalReposts: recycles.reduce((sum, r) => sum + r.repostSchedule.currentRepostCount, 0),
      totalOriginalEngagement: 0,
      totalRepostEngagement: 0,
      averageROI: 0,
      roiByPlatform: {},
      bestROI: null,
      worstROI: null,
      recommendations: []
    };

    const rois = [];

    recycles.forEach(recycle => {
      const original = recycle.originalPerformance?.engagement || 0;
      const repost = recycle.repostPerformance?.engagement || 0;
      const repostCount = recycle.repostSchedule.currentRepostCount;

      if (original > 0 && repostCount > 0) {
        roiAnalysis.totalOriginalEngagement += original;
        roiAnalysis.totalRepostEngagement += repost;

        // ROI = (Repost Engagement / Original Engagement) / Repost Count
        // Higher ROI means more engagement per repost relative to original
        const roi = (repost / original) / repostCount;
        rois.push({
          recycleId: recycle._id,
          contentId: recycle.originalContentId,
          platform: recycle.platform,
          originalEngagement: original,
          repostEngagement: repost,
          repostCount,
          roi: Math.round(roi * 100) / 100,
          efficiency: repost > original ? 'high' : repost > original * 0.8 ? 'good' : 'low'
        });

        // Platform breakdown
        if (!roiAnalysis.roiByPlatform[recycle.platform]) {
          roiAnalysis.roiByPlatform[recycle.platform] = {
            total: 0,
            count: 0,
            totalOriginal: 0,
            totalRepost: 0
          };
        }
        roiAnalysis.roiByPlatform[recycle.platform].total += roi;
        roiAnalysis.roiByPlatform[recycle.platform].count++;
        roiAnalysis.roiByPlatform[recycle.platform].totalOriginal += original;
        roiAnalysis.roiByPlatform[recycle.platform].totalRepost += repost;
      }
    });

    if (rois.length > 0) {
      roiAnalysis.averageROI = rois.reduce((sum, r) => sum + r.roi, 0) / rois.length;
      
      // Find best and worst
      const sorted = [...rois].sort((a, b) => b.roi - a.roi);
      roiAnalysis.bestROI = sorted[0];
      roiAnalysis.worstROI = sorted[sorted.length - 1];

      // Calculate platform averages
      Object.keys(roiAnalysis.roiByPlatform).forEach(platform => {
        const data = roiAnalysis.roiByPlatform[platform];
        data.averageROI = data.total / data.count;
        data.averageOriginal = Math.round(data.totalOriginal / data.count);
        data.averageRepost = Math.round(data.totalRepost / data.count);
      });

      // Generate recommendations
      if (roiAnalysis.averageROI < 0.7) {
        roiAnalysis.recommendations.push('Average ROI is below optimal. Consider improving content refresh strategies.');
      }

      const bestPlatform = Object.entries(roiAnalysis.roiByPlatform)
        .sort((a, b) => b[1].averageROI - a[1].averageROI)[0]?.[0];
      
      if (bestPlatform) {
        roiAnalysis.recommendations.push(`${bestPlatform} shows the best ROI. Focus recycling efforts there.`);
      }
    }

    return {
      hasROI: true,
      ...roiAnalysis,
      allROIs: rois
    };
  } catch (error) {
    logger.error('Error analyzing repost ROI', { error: error.message, userId });
    throw error;
  }
}

/**
 * Detect audience overlap
 */
async function detectAudienceOverlap(userId, recycleId, scheduledTime) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const ScheduledPost = require('../models/ScheduledPost');
    
    // Find recent posts on same platform
    const recentWindow = new Date(scheduledTime);
    recentWindow.setDate(recentWindow.getDate() - 7); // Check last 7 days

    const recentPosts = await ScheduledPost.find({
      userId,
      platform: recycle.platform,
      status: { $in: ['posted', 'scheduled'] },
      $or: [
        { postedAt: { $gte: recentWindow } },
        { scheduledTime: { $gte: recentWindow } }
      ]
    }).lean();

    // Check for same content being posted too frequently
    const sameContentPosts = recentPosts.filter(post => {
      if (post.contentId && recycle.originalContentId) {
        return post.contentId.toString() === recycle.originalContentId.toString();
      }
      return false;
    });

    // Check for similar content (same tags/category)
    const Content = require('../models/Content');
    const originalContent = await Content.findById(recycle.originalContentId).lean();
    
    const similarPosts = recentPosts.filter(post => {
      if (!post.contentId || !originalContent) return false;
      
      // Check if same category
      if (post.content?.category && originalContent.category) {
        if (post.content.category === originalContent.category) {
          return true;
        }
      }
      
      // Check tag overlap
      if (post.content?.tags && originalContent.tags) {
        const overlap = post.content.tags.filter(tag => originalContent.tags.includes(tag));
        if (overlap.length >= 2) {
          return true;
        }
      }
      
      return false;
    });

    const overlapRisk = {
      sameContentCount: sameContentPosts.length,
      similarContentCount: similarPosts.length,
      riskLevel: 'low',
      recommendations: []
    };

    // Determine risk level
    if (sameContentPosts.length > 0) {
      overlapRisk.riskLevel = 'high';
      overlapRisk.recommendations.push('Same content posted recently. Consider delaying repost or refreshing significantly.');
    } else if (similarPosts.length >= 3) {
      overlapRisk.riskLevel = 'medium';
      overlapRisk.recommendations.push('Multiple similar posts detected. Consider spacing out reposts or diversifying content.');
    } else if (similarPosts.length >= 1) {
      overlapRisk.riskLevel = 'low';
      overlapRisk.recommendations.push('Some similar content detected. Monitor audience response.');
    }

    return overlapRisk;
  } catch (error) {
    logger.error('Error detecting audience overlap', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Forecast repost engagement
 */
async function forecastRepostEngagement(userId, recycleId, forecastDays = 30) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const originalEngagement = recycle.originalPerformance?.engagement || 0;
    const repostPerformance = recycle.repostPerformance?.engagement || 0;
    const repostCount = recycle.repostSchedule.currentRepostCount;

    // Calculate engagement trend
    let trend = 1.0;
    if (repostCount > 0 && originalEngagement > 0) {
      trend = repostPerformance / originalEngagement;
    }

    // Forecast future reposts
    const forecast = [];
    const remainingReposts = recycle.repostSchedule.maxReposts - repostCount;
    const interval = recycle.repostSchedule.interval;

    for (let i = 0; i < Math.min(remainingReposts, Math.ceil(forecastDays / interval)); i++) {
      const daysFromNow = (i + 1) * interval;
      const timeDecay = Math.max(0.5, 1 - (daysFromNow / 365));
      const repostDecay = Math.max(0.6, 1 - ((repostCount + i + 1) * 0.1));
      
      const predictedEngagement = originalEngagement * trend * timeDecay * repostDecay;
      
      forecast.push({
        repostNumber: repostCount + i + 1,
        daysFromNow,
        predictedEngagement: Math.round(predictedEngagement),
        confidence: i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
        factors: {
          trend: Math.round(trend * 100) / 100,
          timeDecay: Math.round(timeDecay * 100) / 100,
          repostDecay: Math.round(repostDecay * 100) / 100
        }
      });
    }

    const totalForecasted = forecast.reduce((sum, f) => sum + f.predictedEngagement, 0);

    return {
      forecast,
      totalForecasted,
      averageForecasted: forecast.length > 0 ? Math.round(totalForecasted / forecast.length) : 0,
      remainingReposts,
      forecastPeriod: forecastDays,
      recommendations: generateForecastRecommendations(forecast, originalEngagement)
    };
  } catch (error) {
    logger.error('Error forecasting repost engagement', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Generate forecast recommendations
 */
function generateForecastRecommendations(forecast, originalEngagement) {
  const recommendations = [];

  if (forecast.length === 0) {
    return recommendations;
  }

  const avgForecast = forecast.reduce((sum, f) => sum + f.predictedEngagement, 0) / forecast.length;

  if (avgForecast < originalEngagement * 0.6) {
    recommendations.push('Forecasted engagement is declining significantly. Consider pausing or significantly refreshing content.');
  } else if (avgForecast < originalEngagement * 0.8) {
    recommendations.push('Forecasted engagement is moderate. Consider refreshing content between reposts.');
  } else {
    recommendations.push('Forecasted engagement looks good. Continue current recycling strategy.');
  }

  return recommendations;
}

/**
 * Detect scheduling conflicts
 */
async function detectSchedulingConflicts(userId, recycleId, proposedTime) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    const ScheduledPost = require('../models/ScheduledPost');

    // Check for conflicts in a time window (e.g., 2 hours before/after)
    const conflictWindow = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const windowStart = new Date(proposedTime.getTime() - conflictWindow);
    const windowEnd = new Date(proposedTime.getTime() + conflictWindow);

    const conflicts = await ScheduledPost.find({
      userId,
      platform: recycle.platform,
      status: { $in: ['scheduled', 'posted'] },
      $or: [
        { scheduledTime: { $gte: windowStart, $lte: windowEnd } },
        { postedAt: { $gte: windowStart, $lte: windowEnd } }
      ],
      _id: { $ne: recycle.reposts[recycle.reposts.length - 1]?.postId }
    }).lean();

    // Check for same content conflicts
    const sameContentConflicts = conflicts.filter(post => {
      if (post.contentId && recycle.originalContentId) {
        return post.contentId.toString() === recycle.originalContentId.toString();
      }
      return false;
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      sameContentConflicts: sameContentConflicts.length,
      conflicts: conflicts.map(c => ({
        postId: c._id,
        scheduledTime: c.scheduledTime || c.postedAt,
        title: c.content?.title || 'Untitled',
        timeDifference: Math.round((Math.abs((c.scheduledTime || c.postedAt) - proposedTime) / (1000 * 60))),
        type: sameContentConflicts.some(sc => sc._id.toString() === c._id.toString()) ? 'same-content' : 'time-conflict'
      })),
      recommendations: generateConflictRecommendations(conflicts, sameContentConflicts)
    };
  } catch (error) {
    logger.error('Error detecting scheduling conflicts', { error: error.message, recycleId });
    throw error;
  }
}

/**
 * Generate conflict recommendations
 */
function generateConflictRecommendations(conflicts, sameContentConflicts) {
  const recommendations = [];

  if (sameContentConflicts.length > 0) {
    recommendations.push('Same content scheduled nearby. Consider delaying repost to avoid audience fatigue.');
  }

  if (conflicts.length >= 3) {
    recommendations.push('Multiple posts scheduled in same time window. Consider spacing out posts for better engagement.');
  } else if (conflicts.length > 0) {
    recommendations.push('Post scheduled nearby. Monitor to ensure optimal engagement.');
  }

  return recommendations;
}

/**
 * Create repost A/B test
 */
async function createRepostABTest(userId, recycleId, variations) {
  try {
    const recycle = await ContentRecycle.findById(recycleId);
    if (!recycle) {
      throw new Error('Recycling plan not found');
    }

    if (!variations || variations.length < 2) {
      throw new Error('At least 2 variations required for A/B test');
    }

    // Generate variations if not provided
    let testVariations = variations;
    if (variations.length === 0) {
      const generated = await generateSmartVariations(recycleId, 2);
      testVariations = generated.variations.slice(0, 2);
    }

    // Create A/B test record
    const ABTest = require('../models/ABTest');
    const test = new ABTest({
      userId,
      name: `Repost A/B Test - ${recycle.originalContentId}`,
      type: 'repost',
      recycleId,
      variants: testVariations.map((v, idx) => ({
        variant: idx === 0 ? 'A' : 'B',
        content: {
          title: v.title,
          description: v.description,
          caption: v.caption,
          hashtags: v.hashtags
        },
        score: v.score || 0
      })),
      status: 'active',
      startDate: new Date()
    });

    await test.save();

    // Schedule both variants
    const ScheduledPost = require('../models/ScheduledPost');
    const Content = require('../models/Content');
    const originalContent = await Content.findById(recycle.originalContentId).lean();

    const scheduledPosts = [];
    const baseTime = new Date();
    baseTime.setDate(baseTime.getDate() + 1);

    for (let i = 0; i < testVariations.length; i++) {
      const variation = testVariations[i];
      const scheduledTime = new Date(baseTime);
      scheduledTime.setHours(9 + i, 0, 0, 0); // Space out by 1 hour

      const scheduledPost = new ScheduledPost({
        userId,
        contentId: recycle.originalContentId,
        platform: recycle.platform,
        scheduledTime,
        status: 'scheduled',
        content: {
          title: variation.title || originalContent?.title,
          description: variation.description || originalContent?.description,
          caption: variation.caption || originalContent?.description,
          type: originalContent?.type || 'article',
          hashtags: variation.hashtags || originalContent?.tags || [],
          isRecycled: true,
          originalPostId: recycle.originalPostId,
          abTestId: test._id,
          abTestVariant: i === 0 ? 'A' : 'B'
        }
      });

      await scheduledPost.save();
      scheduledPosts.push(scheduledPost);
    }

    return {
      testId: testId,
      testName: `Repost A/B Test - ${recycle.originalContentId}`,
      variants: testVariations.map((v, idx) => ({
        variant: idx === 0 ? 'A' : 'B',
        content: {
          title: v.title,
          description: v.description,
          caption: v.caption,
          hashtags: v.hashtags
        },
        score: v.score || 0
      })),
      scheduledPosts: scheduledPosts.map(p => ({
        postId: p._id,
        variant: p.content.abTestVariant,
        scheduledTime: p.scheduledTime
      })),
      status: 'active'
    };
  } catch (error) {
    logger.error('Error creating repost A/B test', { error: error.message, recycleId });
    throw error;
  }
}

module.exports = {
  identifyRecyclableContent,
  detectEvergreenContent,
  createRecyclingPlan,
  scheduleNextRepost,
  updateRepostPerformance,
  getRecyclingStats,
  suggestRecyclableContent,
  toggleRecycling,
  detectContentDecay,
  autoAdjustRecycling,
  bulkCreateRecyclingPlans,
  getAdvancedAnalytics,
  optimizeRepostTiming,
  applyAdvancedRefreshStrategy,
  optimizeMultiPlatformRepost,
  getRepostAnalytics,
  generateSmartVariations,
  predictRepostPerformance,
  analyzeRepostROI,
  detectAudienceOverlap,
  forecastRepostEngagement,
  detectSchedulingConflicts,
  createRepostABTest
};

