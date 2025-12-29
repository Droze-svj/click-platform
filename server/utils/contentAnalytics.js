// Content analytics utilities

const Content = require('../models/Content');
const logger = require('./logger');

/**
 * Get content performance analytics
 */
async function getContentAnalytics(userId, period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const contents = await Content.find({
    userId,
    createdAt: { $gte: startDate }
  }).lean();

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

  // Group by type
  contents.forEach(content => {
    analytics.byType[content.type] = (analytics.byType[content.type] || 0) + 1;
    analytics.byStatus[content.status] = (analytics.byStatus[content.status] || 0) + 1;

    // Platform analytics
    if (content.generatedContent?.shortVideos) {
      content.generatedContent.shortVideos.forEach(video => {
        const platform = video.platform || 'unknown';
        analytics.byPlatform[platform] = (analytics.byPlatform[platform] || 0) + 1;
      });
    }

    // Engagement metrics
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

  // Get top performing content
  analytics.bestPerforming = contents
    .filter(c => c.analytics?.engagement)
    .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))
    .slice(0, 5)
    .map(c => ({
      id: c._id,
      title: c.title,
      engagement: c.analytics?.engagement || 0,
      views: c.analytics?.views || 0
    }));

  // Get worst performing content
  analytics.worstPerforming = contents
    .filter(c => c.analytics?.engagement)
    .sort((a, b) => (a.analytics?.engagement || 0) - (b.analytics?.engagement || 0))
    .slice(0, 5)
    .map(c => ({
      id: c._id,
      title: c.title,
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
 * Get content insights
 */
async function getContentInsights(userId) {
  const analytics = await getContentAnalytics(userId, 30);

  const insights = {
    recommendations: [],
    trends: [],
    opportunities: []
  };

  // Recommendations based on performance
  if (analytics.bestPerforming.length > 0) {
    const bestType = analytics.bestPerforming[0].type;
    insights.recommendations.push({
      type: 'content_type',
      message: `Your ${bestType} content performs best. Consider creating more.`,
      priority: 'high'
    });
  }

  // Trends
  if (analytics.trends.daily.length > 7) {
    const recent = analytics.trends.daily.slice(-7);
    const earlier = analytics.trends.daily.slice(-14, -7);
    const recentAvg = recent.reduce((a, b) => a + b.count, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b.count, 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.2) {
      insights.trends.push({
        type: 'growth',
        message: 'Your content creation has increased by 20%+ in the last week.',
        trend: 'up'
      });
    }
  }

  // Opportunities
  if (analytics.byPlatform) {
    const platforms = Object.keys(analytics.byPlatform);
    const allPlatforms = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin'];
    const missingPlatforms = allPlatforms.filter(p => !platforms.includes(p));
    
    if (missingPlatforms.length > 0) {
      insights.opportunities.push({
        type: 'platform',
        message: `Consider expanding to ${missingPlatforms.join(', ')}.`,
        platforms: missingPlatforms
      });
    }
  }

  return insights;
}

module.exports = {
  getContentAnalytics,
  getContentInsights
};







