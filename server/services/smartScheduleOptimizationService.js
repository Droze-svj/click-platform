// Smart Schedule Optimization Service
// AI-powered optimal time prediction and schedule optimization

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { getOptimalPostingTimes } = require('./contentCalendarService');
const { getAudienceInsights } = require('./advancedAudienceInsightsService');
const { getContentPerformance } = require('./contentPerformanceService');

/**
 * Predict optimal posting time using AI
 */
async function predictOptimalTime(userId, contentId, platform, options = {}) {
  try {
    const {
      dateRange = 7,
      considerAudience = true,
      considerPerformance = true,
      considerTrends = true
    } = options;

    const predictions = [];
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);

    // Get historical performance data
    let performanceData = null;
    if (considerPerformance) {
      try {
        performanceData = await getContentPerformance(userId, {
          platform,
          period: 30
        });
      } catch (error) {
        logger.warn('Error getting performance data', { error: error.message });
      }
    }

    // Get audience insights
    let audienceData = null;
    if (considerAudience) {
      try {
        audienceData = await getAudienceInsights(userId, {
          period: 30,
          platform
        });
      } catch (error) {
        logger.warn('Error getting audience data', { error: error.message });
      }
    }

    // Get optimal posting times
    const optimalTimes = await getOptimalPostingTimes(userId, [platform]);
    const platformOptimal = optimalTimes[platform] || ['09:00', '13:00', '17:00'];

    // Generate predictions for each day in range
    for (let i = 0; i < dateRange; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      // Calculate score for each optimal time
      for (const time of platformOptimal) {
        const [hour, minute] = time.split(':').map(Number);
        const scheduledTime = new Date(currentDate);
        scheduledTime.setHours(hour, minute, 0, 0);

        let score = 50; // Base score

        // Day of week factor
        const dayScores = {
          0: 0.7, // Sunday
          1: 0.9, // Monday
          2: 0.95, // Tuesday
          3: 0.95, // Wednesday
          4: 0.9, // Thursday
          5: 0.85, // Friday
          6: 0.8  // Saturday
        };
        score *= dayScores[dayOfWeek] || 1;

        // Audience insights factor
        if (audienceData?.hasData && audienceData.insights.demographics.peakHours) {
          const peakHours = audienceData.insights.demographics.peakHours;
          const matchingPeak = peakHours.find(p => Math.abs(p.hour - hour) <= 1);
          if (matchingPeak) {
            score += 20 * (matchingPeak.percentage / 100);
          }
        }

        // Performance data factor
        if (performanceData?.bestHours) {
          const bestHours = performanceData.bestHours;
          if (bestHours.includes(hour)) {
            score += 15;
          }
        }

        // Avoid weekends for B2B platforms
        if (['linkedin', 'twitter'].includes(platform) && (dayOfWeek === 0 || dayOfWeek === 6)) {
          score *= 0.7;
        }

        // Avoid late night/early morning
        if (hour < 6 || hour > 23) {
          score *= 0.5;
        }

        predictions.push({
          scheduledTime,
          score: Math.round(score),
          confidence: score > 80 ? 'high' : score > 60 ? 'medium' : 'low',
          factors: {
            dayOfWeek,
            hour,
            optimalTime: platformOptimal.includes(time),
            audienceMatch: audienceData?.hasData ? true : false,
            performanceMatch: performanceData ? true : false
          }
        });
      }
    }

    // Sort by score
    predictions.sort((a, b) => b.score - a.score);

    return {
      predictions: predictions.slice(0, 10), // Top 10
      bestTime: predictions[0],
      platform,
      dateRange,
      recommendations: generateTimeRecommendations(predictions[0], platform)
    };
  } catch (error) {
    logger.error('Error predicting optimal time', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Generate time recommendations
 */
function generateTimeRecommendations(bestTime, platform) {
  const recommendations = [];

  if (bestTime.score > 80) {
    recommendations.push('Excellent time slot - high engagement expected');
  } else if (bestTime.score > 60) {
    recommendations.push('Good time slot - moderate engagement expected');
  } else {
    recommendations.push('Consider rescheduling for better engagement');
  }

  if (bestTime.factors.dayOfWeek === 0 || bestTime.factors.dayOfWeek === 6) {
    if (['linkedin', 'twitter'].includes(platform)) {
      recommendations.push('Weekend posting may have lower engagement for B2B platforms');
    }
  }

  return recommendations;
}

/**
 * Get schedule suggestions
 */
async function getScheduleSuggestions(userId, options = {}) {
  try {
    const {
      dateRange = 7,
      platforms = null,
      minPostsPerDay = 1,
      maxPostsPerDay = 5
    } = options;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);

    // Get existing scheduled posts
    const existingQuery = {
      userId,
      status: { $in: ['scheduled', 'pending'] },
      scheduledTime: { $gte: startDate, $lte: endDate }
    };
    if (platforms) {
      existingQuery.platform = { $in: platforms };
    }

    const existingPosts = await ScheduledPost.find(existingQuery).lean();

    // Get available content
    const content = await Content.find({
      userId,
      status: { $in: ['completed', 'draft'] }
    })
      .limit(50)
      .lean();

    // Analyze schedule gaps
    const suggestions = [];
    const platformsToCheck = platforms || ['instagram', 'twitter', 'linkedin', 'facebook'];

    for (let i = 0; i < dateRange; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const platform of platformsToCheck) {
        const dayPosts = existingPosts.filter(p => {
          const postDate = new Date(p.scheduledTime).toISOString().split('T')[0];
          return postDate === dateStr && p.platform === platform;
        });

        if (dayPosts.length < minPostsPerDay) {
          // Get optimal time for this day
          const optimalTime = await predictOptimalTime(userId, content[0]?._id, platform, {
            dateRange: 1,
            considerAudience: true,
            considerPerformance: true
          });

          if (optimalTime.bestTime) {
            suggestions.push({
              date: dateStr,
              platform,
              recommendedTime: optimalTime.bestTime.scheduledTime,
              score: optimalTime.bestTime.score,
              reason: `Only ${dayPosts.length} post(s) scheduled. Recommended: ${minPostsPerDay - dayPosts.length} more.`,
              availableContent: content.length
            });
          }
        }
      }
    }

    return {
      suggestions: suggestions.slice(0, 20), // Top 20 suggestions
      totalSuggestions: suggestions.length,
      dateRange,
      recommendations: generateScheduleRecommendations(suggestions)
    };
  } catch (error) {
    logger.error('Error getting schedule suggestions', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate schedule recommendations
 */
function generateScheduleRecommendations(suggestions) {
  const recommendations = [];

  if (suggestions.length === 0) {
    recommendations.push('Your schedule looks balanced. No immediate suggestions.');
    return recommendations;
  }

  const platformCounts = {};
  suggestions.forEach(s => {
    platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
  });

  const topPlatform = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  if (topPlatform) {
    recommendations.push(`Consider scheduling more content for ${topPlatform} - ${platformCounts[topPlatform]} opportunities identified.`);
  }

  recommendations.push(`Total scheduling opportunities: ${suggestions.length}`);

  return recommendations;
}

/**
 * Auto-reschedule based on performance
 */
async function autoRescheduleBasedOnPerformance(userId, postId) {
  try {
    const post = await ScheduledPost.findById(postId);
    if (!post || post.userId.toString() !== userId.toString()) {
      throw new Error('Post not found');
    }

    // Get performance data for similar content
    const content = await Content.findById(post.contentId).lean();
    if (!content) {
      throw new Error('Content not found');
    }

    // Get best performing times for this platform
    const performanceData = await getContentPerformance(userId, {
      platform: post.platform,
      period: 30
    });

    if (!performanceData?.bestHours || performanceData.bestHours.length === 0) {
      return { rescheduled: false, reason: 'Insufficient performance data' };
    }

    const currentHour = new Date(post.scheduledTime).getHours();
    const bestHour = performanceData.bestHours[0];

    // Only reschedule if significantly different
    if (Math.abs(currentHour - bestHour) > 2) {
      const newTime = new Date(post.scheduledTime);
      newTime.setHours(bestHour, 0, 0, 0);

      // Check conflicts
      const { detectConflicts } = require('./advancedSchedulingService');
      const conflicts = await detectConflicts(userId, newTime, post.platform, postId);

      if (!conflicts.hasConflicts) {
        post.scheduledTime = newTime;
        post.optimizationScore = 85; // High score for performance-based reschedule
        await post.save();

        return {
          rescheduled: true,
          oldTime: post.scheduledTime,
          newTime,
          reason: `Rescheduled to optimal hour (${bestHour}:00) based on performance data`,
          performanceImprovement: `Expected ${Math.abs(currentHour - bestHour) * 5}% engagement increase`
        };
      }
    }

    return { rescheduled: false, reason: 'Already at optimal time or conflicts detected' };
  } catch (error) {
    logger.error('Error auto-rescheduling', { error: error.message, postId });
    throw error;
  }
}

/**
 * Monitor schedule health
 */
async function monitorScheduleHealth(userId, dateRange = 7) {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);

    const posts = await ScheduledPost.find({
      userId,
      scheduledTime: { $gte: startDate, $lte: endDate }
    }).lean();

    const health = {
      overallScore: 0,
      totalPosts: posts.length,
      issues: [],
      warnings: [],
      recommendations: [],
      metrics: {
        conflictRate: 0,
        optimalTimeUsage: 0,
        platformBalance: {},
        dayDistribution: {},
        timeDistribution: {}
      }
    };

    // Check for conflicts
    const conflicts = posts.filter(p => p.conflictResolved).length;
    health.metrics.conflictRate = posts.length > 0 ? (conflicts / posts.length) * 100 : 0;

    // Check optimal time usage
    const optimalPosts = posts.filter(p => p.optimizationScore > 70).length;
    health.metrics.optimalTimeUsage = posts.length > 0 ? (optimalPosts / posts.length) * 100 : 0;

    // Platform balance
    const platformCounts = {};
    posts.forEach(p => {
      platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
    });
    health.metrics.platformBalance = platformCounts;

    // Day distribution
    posts.forEach(p => {
      const day = new Date(p.scheduledTime).toLocaleDateString('en-US', { weekday: 'long' });
      health.metrics.dayDistribution[day] = (health.metrics.dayDistribution[day] || 0) + 1;
    });

    // Time distribution
    posts.forEach(p => {
      const hour = new Date(p.scheduledTime).getHours();
      health.metrics.timeDistribution[hour] = (health.metrics.timeDistribution[hour] || 0) + 1;
    });

    // Calculate overall score
    let score = 100;

    // Deduct for conflicts
    score -= health.metrics.conflictRate * 0.5;

    // Deduct for suboptimal times
    score -= (100 - health.metrics.optimalTimeUsage) * 0.3;

    // Check platform balance
    const platforms = Object.keys(platformCounts);
    if (platforms.length > 0) {
      const avg = Object.values(platformCounts).reduce((a, b) => a + b, 0) / platforms.length;
      const imbalance = platforms.reduce((sum, p) => {
        const diff = Math.abs(platformCounts[p] - avg);
        return sum + diff;
      }, 0);
      score -= (imbalance / posts.length) * 20;
    }

    health.overallScore = Math.max(0, Math.round(score));

    // Generate issues and recommendations
    if (health.metrics.conflictRate > 10) {
      health.issues.push({
        type: 'conflicts',
        severity: 'high',
        message: `${health.metrics.conflictRate.toFixed(1)}% of posts have conflicts`,
        recommendation: 'Review and resolve scheduling conflicts'
      });
    }

    if (health.metrics.optimalTimeUsage < 70) {
      health.warnings.push({
        type: 'suboptimal_timing',
        message: `Only ${health.metrics.optimalTimeUsage.toFixed(1)}% of posts use optimal times`,
        recommendation: 'Consider using schedule optimization'
      });
    }

    if (health.overallScore < 70) {
      health.recommendations.push('Schedule health is below optimal. Review recommendations and optimize.');
    }

    return health;
  } catch (error) {
    logger.error('Error monitoring schedule health', { error: error.message, userId });
    throw error;
  }
}

/**
 * Preview schedule
 */
async function previewSchedule(userId, scheduleData, dateRange = 7) {
  try {
    const {
      contentIds,
      platforms,
      frequency,
      startDate,
      timezone = 'UTC'
    } = scheduleData;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + dateRange);

    const preview = {
      totalPosts: 0,
      posts: [],
      conflicts: [],
      gaps: [],
      platformDistribution: {},
      dayDistribution: {},
      recommendations: []
    };

    // Get existing posts for conflict detection
    const existingPosts = await ScheduledPost.find({
      userId,
      status: { $in: ['scheduled', 'pending'] },
      scheduledTime: { $gte: start, $lte: end }
    }).lean();

    let currentDate = new Date(start);
    let contentIndex = 0;

    while (currentDate <= end && contentIndex < contentIds.length) {
      for (const platform of platforms) {
        const optimalTimes = await getOptimalPostingTimes(userId, [platform]);
        const time = optimalTimes[platform]?.[0] || '09:00';
        const [hour, minute] = time.split(':').map(Number);

        const scheduledTime = new Date(currentDate);
        scheduledTime.setHours(hour, minute, 0, 0);

        // Check conflicts
        const conflicts = existingPosts.filter(p => {
          const timeDiff = Math.abs(p.scheduledTime - scheduledTime) / (1000 * 60 * 60);
          return p.platform === platform && timeDiff < 2;
        });

        if (conflicts.length > 0) {
          preview.conflicts.push({
            date: scheduledTime,
            platform,
            contentId: contentIds[contentIndex],
            conflictCount: conflicts.length
          });
        }

        preview.posts.push({
          date: scheduledTime.toISOString(),
          platform,
          contentId: contentIds[contentIndex],
          time,
          hasConflict: conflicts.length > 0
        });

        preview.totalPosts++;
        preview.platformDistribution[platform] = (preview.platformDistribution[platform] || 0) + 1;

        const day = scheduledTime.toLocaleDateString('en-US', { weekday: 'long' });
        preview.dayDistribution[day] = (preview.dayDistribution[day] || 0) + 1;
      }

      // Increment based on frequency
      if (frequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      }

      contentIndex++;
    }

    // Generate recommendations
    if (preview.conflicts.length > 0) {
      preview.recommendations.push(`Warning: ${preview.conflicts.length} potential conflicts detected`);
    }

    if (preview.totalPosts < dateRange) {
      preview.recommendations.push(`Consider adding more content to fill ${dateRange - preview.totalPosts} days`);
    }

    return preview;
  } catch (error) {
    logger.error('Error previewing schedule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Bulk schedule with optimization
 */
async function bulkScheduleOptimized(userId, scheduleData) {
  try {
    const {
      contentIds,
      platforms,
      startDate,
      frequency = 'daily',
      optimizeTimes = true,
      resolveConflicts = true,
      timezone = 'UTC'
    } = scheduleData;

    const results = {
      scheduled: [],
      conflicts: [],
      optimized: [],
      failed: []
    };

    const { scheduleWithTimezone, detectConflicts, resolveConflicts: resolve } = require('./advancedSchedulingService');

    let currentDate = new Date(startDate);

    for (let i = 0; i < contentIds.length; i++) {
      const contentId = contentIds[i];

      for (const platform of platforms) {
        try {
          // Get optimal time if optimization enabled
          let scheduledTime = new Date(currentDate);
          if (optimizeTimes) {
            const prediction = await predictOptimalTime(userId, contentId, platform, {
              dateRange: 1,
              considerAudience: true,
              considerPerformance: true
            });

            if (prediction.bestTime) {
              scheduledTime = prediction.bestTime.scheduledTime;
            } else {
              scheduledTime.setHours(9, 0, 0, 0);
            }
          } else {
            scheduledTime.setHours(9, 0, 0, 0);
          }

          // Check conflicts
          const conflicts = await detectConflicts(userId, scheduledTime, platform);
          if (conflicts.hasConflicts && resolveConflicts) {
            // Try to find next available slot
            let newTime = new Date(scheduledTime);
            newTime.setHours(newTime.getHours() + 2);
            
            let attempts = 0;
            while (attempts < 10) {
              const newConflicts = await detectConflicts(userId, newTime, platform);
              if (!newConflicts.hasConflicts) {
                scheduledTime = newTime;
                results.optimized.push({ contentId, platform, originalTime: scheduledTime, newTime });
                break;
              }
              newTime.setHours(newTime.getHours() + 1);
              attempts++;
            }
            
            if (attempts >= 10) {
              results.conflicts.push({ contentId, platform, scheduledTime, conflictCount: conflicts.conflictCount });
              continue;
            }
          } else if (conflicts.hasConflicts) {
            results.conflicts.push({ contentId, platform, scheduledTime, conflictCount: conflicts.conflictCount });
            continue;
          }

          // Schedule post
          const post = await scheduleWithTimezone(userId, contentId, platform, scheduledTime, timezone);
          results.scheduled.push({ postId: post._id, contentId, platform, scheduledTime });

        } catch (error) {
          logger.error('Error in bulk scheduling', { error: error.message, contentId, platform });
          results.failed.push({ contentId, platform, error: error.message });
        }
      }

      // Increment date
      if (frequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in bulk schedule optimized', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  predictOptimalTime,
  getScheduleSuggestions,
  autoRescheduleBasedOnPerformance,
  monitorScheduleHealth,
  previewSchedule,
  bulkScheduleOptimized
};

