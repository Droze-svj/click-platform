// Calendar Analytics Service
// Analytics and insights for calendar

const ScheduledPost = require('../models/ScheduledPost');
const Workspace = require('../models/Workspace');
const { getOptimalPostingTimes } = require('./smartScheduleOptimizationService');
const logger = require('../utils/logger');

/**
 * Get calendar analytics
 */
async function getCalendarAnalytics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      clientWorkspaceIds = []
    } = filters;

    const query = {
      agencyWorkspaceId,
      status: { $in: ['scheduled', 'posted'] }
    };

    if (clientWorkspaceIds.length > 0) {
      query.clientWorkspaceId = { $in: clientWorkspaceIds };
    }

    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    const posts = await ScheduledPost.find(query).lean();

    // Posting frequency analysis
    const frequency = analyzePostingFrequency(posts);

    // Platform distribution
    const platformDistribution = analyzePlatformDistribution(posts);

    // Time distribution
    const timeDistribution = analyzeTimeDistribution(posts);

    // Content gaps
    const gaps = identifyContentGaps(posts, startDate, endDate);

    // Optimal time recommendations
    const recommendations = await generateOptimalTimeRecommendations(posts, clientWorkspaceIds);

    // Team workload
    const workload = analyzeTeamWorkload(posts);

    // Client activity
    const clientActivity = analyzeClientActivity(posts);

    return {
      frequency,
      platformDistribution,
      timeDistribution,
      gaps,
      recommendations,
      workload,
      clientActivity,
      summary: {
        totalPosts: posts.length,
        scheduled: posts.filter(p => p.status === 'scheduled').length,
        posted: posts.filter(p => p.status === 'posted').length,
        dateRange: {
          earliest: posts.length > 0 ? new Date(Math.min(...posts.map(p => new Date(p.scheduledTime)))) : null,
          latest: posts.length > 0 ? new Date(Math.max(...posts.map(p => new Date(p.scheduledTime)))) : null
        }
      }
    };
  } catch (error) {
    logger.error('Error getting calendar analytics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Analyze posting frequency
 */
function analyzePostingFrequency(posts) {
  const frequency = {
    daily: {},
    weekly: {},
    monthly: {}
  };

  posts.forEach(post => {
    const date = new Date(post.scheduledTime);
    const dayKey = date.toISOString().split('T')[0];
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    frequency.daily[dayKey] = (frequency.daily[dayKey] || 0) + 1;
    frequency.weekly[weekKey] = (frequency.weekly[weekKey] || 0) + 1;
    frequency.monthly[monthKey] = (frequency.monthly[monthKey] || 0) + 1;
  });

  return {
    daily: Object.entries(frequency.daily).map(([date, count]) => ({ date, count })),
    weekly: Object.entries(frequency.weekly).map(([week, count]) => ({ week, count })),
    monthly: Object.entries(frequency.monthly).map(([month, count]) => ({ month, count })),
    averagePerDay: posts.length / (Object.keys(frequency.daily).length || 1),
    averagePerWeek: posts.length / (Object.keys(frequency.weekly).length || 1),
    averagePerMonth: posts.length / (Object.keys(frequency.monthly).length || 1)
  };
}

/**
 * Analyze platform distribution
 */
function analyzePlatformDistribution(posts) {
  const distribution = {};

  posts.forEach(post => {
    distribution[post.platform] = (distribution[post.platform] || 0) + 1;
  });

  const total = posts.length;
  const percentages = Object.entries(distribution).map(([platform, count]) => ({
    platform,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }));

  return {
    distribution,
    percentages,
    total
  };
}

/**
 * Analyze time distribution
 */
function analyzeTimeDistribution(posts) {
  const hourly = Array(24).fill(0);
  const daily = Array(7).fill(0); // 0 = Sunday

  posts.forEach(post => {
    const date = new Date(post.scheduledTime);
    const hour = date.getHours();
    const day = date.getDay();

    hourly[hour]++;
    daily[day]++;
  });

  return {
    hourly: hourly.map((count, hour) => ({ hour, count })),
    daily: daily.map((count, day) => ({ day, dayName: getDayName(day), count })),
    peakHour: hourly.indexOf(Math.max(...hourly)),
    peakDay: daily.indexOf(Math.max(...daily))
  };
}

/**
 * Identify content gaps
 */
function identifyContentGaps(posts, startDate, endDate) {
  const gaps = [];
  const sortedPosts = [...posts].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  if (sortedPosts.length < 2) {
    return gaps;
  }

  for (let i = 0; i < sortedPosts.length - 1; i++) {
    const current = new Date(sortedPosts[i].scheduledTime);
    const next = new Date(sortedPosts[i + 1].scheduledTime);
    const gapHours = (next - current) / (1000 * 60 * 60);

    if (gapHours > 48) { // Gap larger than 2 days
      gaps.push({
        start: current,
        end: next,
        durationHours: gapHours,
        durationDays: Math.round(gapHours / 24),
        platform: sortedPosts[i].platform,
        clientWorkspaceId: sortedPosts[i].clientWorkspaceId
      });
    }
  }

  return gaps.sort((a, b) => b.durationHours - a.durationHours);
}

/**
 * Generate optimal time recommendations
 */
async function generateOptimalTimeRecommendations(posts, clientWorkspaceIds) {
  const recommendations = [];

  // Group by client and platform
  const grouped = {};
  posts.forEach(post => {
    const key = `${post.clientWorkspaceId}_${post.platform}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(post);
  });

  for (const [key, clientPosts] of Object.entries(grouped)) {
    const [clientId, platform] = key.split('_');
    const clientWorkspace = await Workspace.findById(clientId);
    if (!clientWorkspace) continue;

    // Get optimal times for this client/platform
    try {
      const optimalTimes = await getOptimalPostingTimes(
        clientWorkspace.ownerId,
        platform,
        new Date()
      );

      // Find gaps where we could add posts
      const currentTimes = clientPosts.map(p => new Date(p.scheduledTime).getHours());
      const suggestedTimes = optimalTimes.filter(time => {
        const hour = parseInt(time.split(':')[0]);
        return !currentTimes.includes(hour);
      });

      if (suggestedTimes.length > 0) {
        recommendations.push({
          clientWorkspaceId: clientId,
          clientName: clientWorkspace.name,
          platform,
          suggestedTimes,
          currentPostCount: clientPosts.length,
          reason: 'Optimal posting times not fully utilized'
        });
      }
    } catch (error) {
      logger.warn('Error getting optimal times', { error: error.message, clientId, platform });
    }
  }

  return recommendations;
}

/**
 * Analyze team workload
 */
function analyzeTeamWorkload(posts) {
  const workload = {};

  posts.forEach(post => {
    const userId = post.userId?.toString() || 'unknown';
    if (!workload[userId]) {
      workload[userId] = {
        userId,
        totalPosts: 0,
        byPlatform: {},
        byClient: {},
        byStatus: {}
      };
    }

    workload[userId].totalPosts++;
    workload[userId].byPlatform[post.platform] = (workload[userId].byPlatform[post.platform] || 0) + 1;
    workload[userId].byClient[post.clientWorkspaceId?.toString() || 'unknown'] = 
      (workload[userId].byClient[post.clientWorkspaceId?.toString() || 'unknown'] || 0) + 1;
    workload[userId].byStatus[post.status] = (workload[userId].byStatus[post.status] || 0) + 1;
  });

  return Object.values(workload).map(w => ({
    ...w,
    averagePerDay: w.totalPosts / 30 // Rough estimate
  }));
}

/**
 * Analyze client activity
 */
function analyzeClientActivity(posts) {
  const activity = {};

  posts.forEach(post => {
    const clientId = post.clientWorkspaceId?.toString() || 'unknown';
    if (!activity[clientId]) {
      activity[clientId] = {
        clientWorkspaceId: clientId,
        totalPosts: 0,
        byPlatform: {},
        byStatus: {},
        lastPost: null
      };
    }

    activity[clientId].totalPosts++;
    activity[clientId].byPlatform[post.platform] = (activity[clientId].byPlatform[post.platform] || 0) + 1;
    activity[clientId].byStatus[post.status] = (activity[clientId].byStatus[post.status] || 0) + 1;

    const postDate = new Date(post.scheduledTime);
    if (!activity[clientId].lastPost || postDate > activity[clientId].lastPost) {
      activity[clientId].lastPost = postDate;
    }
  });

  return Object.values(activity);
}

// Helper functions
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDayName(day) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
}

module.exports = {
  getCalendarAnalytics
};


