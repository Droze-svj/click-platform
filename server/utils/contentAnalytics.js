// Content analytics utilities

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const SocialConnection = require('../models/SocialConnection');
const User = require('../models/User');
const logger = require('./logger');

/**
 * Get connected platforms for user (SocialConnection + User.oauth for LinkedIn/Facebook)
 */
async function getConnectedPlatforms(userId) {
  const platforms = new Set();
  try {
    if (SocialConnection) {
      const conns = await SocialConnection.find({ userId, isActive: true }).select('platform').lean();
      conns.forEach(c => platforms.add(c.platform));
    }
    const user = await User.findById(userId).select('oauth').lean();
    if (user?.oauth?.facebook?.connected) platforms.add('facebook');
    if (user?.oauth?.linkedin?.connected) platforms.add('linkedin');
  } catch (e) { logger.warn('getConnectedPlatforms:', e?.message); }
  return Array.from(platforms);
}

/**
 * Get content performance analytics
 */
async function getContentAnalytics(userId, period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const [contents, postedContent] = await Promise.all([
    Content.find({ userId, createdAt: { $gte: startDate } }).lean(),
    ScheduledPost.find({ userId, status: 'posted', postedAt: { $gte: startDate } }).populate('contentId').lean()
  ]);

  const analytics = {
    total: contents.length,
    byType: {},
    byStatus: {},
    byPlatform: {},
    engagement: {
      totalViews: 0,
      totalEngagement: 0,
      averageEngagement: 0,
      topPerforming: []
    },
    trends: {
      daily: [],
      weekly: []
    },
    bestPerforming: [],
    worstPerforming: []
  };

  // Platform & engagement from posted content
  postedContent.forEach(p => {
    const platform = p.platform || 'unknown';
    analytics.byPlatform[platform] = (analytics.byPlatform[platform] || 0) + 1;
    analytics.engagement.totalEngagement += p.engagement || 0;
  });

  // Content structure
  contents.forEach(content => {
    analytics.byType[content.type || 'post'] = (analytics.byType[content.type || 'post'] || 0) + 1;
    analytics.byStatus[content.status || 'published'] = (analytics.byStatus[content.status || 'published'] || 0) + 1;
    if (content.generatedContent?.shortVideos) {
      content.generatedContent.shortVideos.forEach(video => {
        const platform = video.platform || 'unknown';
        analytics.byPlatform[platform] = (analytics.byPlatform[platform] || 0) + 1;
      });
    }
    if (content.analytics) {
      analytics.engagement.totalViews += content.analytics.views || 0;
      analytics.engagement.totalEngagement += content.analytics.engagement || 0;
    }
  });

  // Calculate averages
  if (contents.length > 0) {
    analytics.engagement.averageEngagement =
      analytics.engagement.totalEngagement / contents.length;
  }

  const withEngagement = [...contents];
  postedContent.forEach(p => {
    if (p.contentId && !contents.some(c => c._id?.toString() === p.contentId?._id?.toString())) {
      withEngagement.push({ ...p.contentId, analytics: { ...(p.contentId?.analytics || {}), engagement: (p.contentId?.analytics?.engagement || 0) + (p.engagement || 0) } });
    } else if (p.contentId) {
      const idx = withEngagement.findIndex(c => c._id?.toString() === p.contentId?._id?.toString());
      if (idx >= 0) {
        withEngagement[idx].analytics = withEngagement[idx].analytics || {};
        withEngagement[idx].analytics.engagement = (withEngagement[idx].analytics.engagement || 0) + (p.engagement || 0);
      }
    }
  });

  analytics.bestPerforming = withEngagement
    .filter(c => (c.analytics?.engagement || 0) > 0)
    .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))
    .slice(0, 5)
    .map(c => ({
      id: c._id,
      title: c.title,
      type: c.type || 'post',
      engagement: c.analytics?.engagement || 0,
      views: c.analytics?.views || 0
    }));

  analytics.worstPerforming = withEngagement
    .filter(c => (c.analytics?.engagement || 0) > 0)
    .sort((a, b) => (a.analytics?.engagement || 0) - (b.analytics?.engagement || 0))
    .slice(0, 5)
    .map(c => ({
      id: c._id,
      title: c.title,
      type: c.type || 'post',
      engagement: c.analytics?.engagement || 0,
      views: c.analytics?.views || 0
    }));

  // Daily trends
  const dailyMap = {};
  contents.forEach(content => {
    const date = new Date(content.createdAt).toISOString().split('T')[0];
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });
  analytics.trends.daily = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return analytics;
}

/**
 * Get content insights - uses real analytics + connected accounts for accurate, actionable advice
 */
async function getContentInsights(userId) {
  const [analytics, connectedPlatforms] = await Promise.all([
    getContentAnalytics(userId, 30),
    getConnectedPlatforms(userId)
  ]);

  const insights = {
    recommendations: [],
    trends: [],
    opportunities: []
  };

  // Recommendations based on actual performance
  if (analytics.bestPerforming.length > 0) {
    const best = analytics.bestPerforming[0];
    insights.recommendations.push({
      type: 'content_type',
      message: `Your ${best.type || 'content'} performs best (${best.engagement} engagement). Consider creating more.`,
      priority: 'high',
      data: { topType: best.type, engagement: best.engagement }
    });
  }

  // Trends from real data
  if (analytics.trends.daily.length >= 14) {
    const recent = analytics.trends.daily.slice(-7);
    const earlier = analytics.trends.daily.slice(-14, -7);
    const recentAvg = recent.reduce((a, b) => a + b.count, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b.count, 0) / Math.max(1, earlier.length);
    if (earlierAvg > 0 && recentAvg > earlierAvg * 1.2) {
      insights.trends.push({
        type: 'growth',
        message: `Content creation up ${Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100)}% vs prior week.`,
        trend: 'up'
      });
    } else if (earlierAvg > 0 && recentAvg < earlierAvg * 0.8) {
      insights.trends.push({
        type: 'decline',
        message: `Content creation down vs prior week. Consider posting more.`,
        trend: 'down'
      });
    }
  }

  // Opportunities: only suggest platforms user has connected but isn't posting to
  const postingPlatforms = Object.keys(analytics.byPlatform || {});
  const connectedNotPosting = connectedPlatforms.filter(p => !postingPlatforms.includes(p));
  if (connectedNotPosting.length > 0) {
    insights.opportunities.push({
      type: 'platform',
      message: `You've connected ${connectedNotPosting.join(', ')} but haven't posted recently. Start publishing to grow.`,
      platforms: connectedNotPosting
    });
  }
  // Also suggest connecting platforms not yet linked
  const allPlatforms = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook'];
  const notConnected = allPlatforms.filter(p => !connectedPlatforms.includes(p));
  if (notConnected.length > 0 && postingPlatforms.length > 0) {
    insights.opportunities.push({
      type: 'connect',
      message: `Connect ${notConnected.join(', ')} to expand your reach.`,
      platforms: notConnected
    });
  }

  return insights;
}

module.exports = {
  getContentAnalytics,
  getContentInsights,
  getConnectedPlatforms
};







