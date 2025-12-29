// Advanced Audience Insights Service
// Comprehensive audience analysis and segmentation

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get comprehensive audience insights
 */
async function getAudienceInsights(userId, options = {}) {
  try {
    const {
      period = 90,
      platform = null
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get all posts
    const query = {
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    };

    if (platform) {
      query.platform = platform;
    }

    const posts = await ScheduledPost.find(query)
      .populate('contentId')
      .sort({ postedAt: -1 })
      .lean();

    if (posts.length === 0) {
      return {
        hasData: false,
        message: 'No posted content available for analysis'
      };
    }

    // Analyze different aspects
    const insights = {
      overview: await getOverviewInsights(posts, period),
      engagement: await getEngagementInsights(posts),
      demographics: await getDemographicInsights(posts),
      behavior: await getBehaviorInsights(posts),
      preferences: await getContentPreferences(posts),
      growth: await getAudienceGrowth(posts, period),
      segments: await getAudienceSegments(posts),
      recommendations: []
    };

    // Generate recommendations
    insights.recommendations = generateAudienceRecommendations(insights);

    return {
      hasData: true,
      period,
      platform,
      totalPosts: posts.length,
      insights
    };
  } catch (error) {
    logger.error('Error getting audience insights', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get overview insights
 */
async function getOverviewInsights(posts, period) {
  const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
  const totalImpressions = posts.reduce((sum, p) => sum + (p.analytics?.impressions || p.analytics?.views || 0), 0);
  const totalClicks = posts.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.analytics?.shares || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.analytics?.comments || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.analytics?.likes || 0), 0);

  const avgEngagement = totalEngagement / posts.length;
  const avgImpressions = totalImpressions / posts.length;
  const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
  const clickThroughRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Platform distribution
  const platformDistribution = {};
  posts.forEach(post => {
    platformDistribution[post.platform] = (platformDistribution[post.platform] || 0) + 1;
  });

  return {
    totalEngagement,
    totalImpressions,
    totalClicks,
    totalShares,
    totalComments,
    totalLikes,
    avgEngagement: Math.round(avgEngagement),
    avgImpressions: Math.round(avgImpressions),
    engagementRate: Math.round(engagementRate * 100) / 100,
    clickThroughRate: Math.round(clickThroughRate * 100) / 100,
    platformDistribution,
    postsPerDay: Math.round((posts.length / period) * 10) / 10
  };
}

/**
 * Get engagement insights
 */
async function getEngagementInsights(posts) {
  // Engagement by platform
  const platformEngagement = {};
  const platformPosts = {};

  posts.forEach(post => {
    const platform = post.platform;
    if (!platformEngagement[platform]) {
      platformEngagement[platform] = 0;
      platformPosts[platform] = 0;
    }
    platformEngagement[platform] += post.analytics?.engagement || 0;
    platformPosts[platform]++;
  });

  const platformAverages = {};
  Object.keys(platformEngagement).forEach(platform => {
    platformAverages[platform] = Math.round(platformEngagement[platform] / platformPosts[platform]);
  });

  // Engagement by content type
  const typeEngagement = {};
  const typePosts = {};

  posts.forEach(post => {
    if (post.contentId) {
      const type = post.contentId.type || 'unknown';
      if (!typeEngagement[type]) {
        typeEngagement[type] = 0;
        typePosts[type] = 0;
      }
      typeEngagement[type] += post.analytics?.engagement || 0;
      typePosts[type]++;
    }
  });

  const typeAverages = {};
  Object.keys(typeEngagement).forEach(type => {
    typeAverages[type] = Math.round(typeEngagement[type] / typePosts[type]);
  });

  // Engagement by day of week
  const dayEngagement = {};
  const dayPosts = {};

  posts.forEach(post => {
    const day = new Date(post.postedAt).getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    
    if (!dayEngagement[dayName]) {
      dayEngagement[dayName] = 0;
      dayPosts[dayName] = 0;
    }
    dayEngagement[dayName] += post.analytics?.engagement || 0;
    dayPosts[dayName]++;
  });

  const dayAverages = {};
  Object.keys(dayEngagement).forEach(day => {
    dayAverages[day] = Math.round(dayEngagement[day] / dayPosts[day]);
  });

  // Engagement by hour
  const hourEngagement = {};
  const hourPosts = {};

  posts.forEach(post => {
    const hour = new Date(post.postedAt).getHours();
    
    if (!hourEngagement[hour]) {
      hourEngagement[hour] = 0;
      hourPosts[hour] = 0;
    }
    hourEngagement[hour] += post.analytics?.engagement || 0;
    hourPosts[hour]++;
  });

  const hourAverages = {};
  Object.keys(hourEngagement).forEach(hour => {
    hourAverages[hour] = Math.round(hourEngagement[hour] / hourPosts[hour]);
  });

  // Best performing posts
  const topPosts = posts
    .map(post => ({
      contentId: post.contentId?._id,
      title: post.contentId?.title || 'Untitled',
      platform: post.platform,
      engagement: post.analytics?.engagement || 0,
      postedAt: post.postedAt
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);

  return {
    platformAverages,
    typeAverages,
    dayAverages,
    hourAverages,
    topPosts,
    engagementTrend: calculateEngagementTrend(posts)
  };
}

/**
 * Calculate engagement trend
 */
function calculateEngagementTrend(posts) {
  if (posts.length < 2) {
    return { direction: 'stable', change: 0 };
  }

  // Split into two halves
  const firstHalf = posts.slice(Math.floor(posts.length / 2));
  const secondHalf = posts.slice(0, Math.floor(posts.length / 2));

  const firstAvg = firstHalf.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / secondHalf.length;

  const change = firstAvg > 0 ? ((secondAvg / firstAvg) - 1) * 100 : 0;

  return {
    direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
    change: Math.round(change * 10) / 10
  };
}

/**
 * Get demographic insights (inferred from engagement patterns)
 */
async function getDemographicInsights(posts) {
  // Analyze engagement patterns to infer demographics
  const insights = {
    activeHours: {},
    activeDays: {},
    contentPreferences: {},
    engagementStyle: {}
  };

  // Active hours analysis
  posts.forEach(post => {
    const hour = new Date(post.postedAt).getHours();
    const engagement = post.analytics?.engagement || 0;
    
    if (!insights.activeHours[hour]) {
      insights.activeHours[hour] = { total: 0, count: 0 };
    }
    insights.activeHours[hour].total += engagement;
    insights.activeHours[hour].count++;
  });

  const activeHours = Object.entries(insights.activeHours)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEngagement: Math.round(data.total / data.count),
      posts: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5);

  // Active days analysis
  posts.forEach(post => {
    const day = new Date(post.postedAt).getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    const engagement = post.analytics?.engagement || 0;
    
    if (!insights.activeDays[dayName]) {
      insights.activeDays[dayName] = { total: 0, count: 0 };
    }
    insights.activeDays[dayName].total += engagement;
    insights.activeDays[dayName].count++;
  });

  const activeDays = Object.entries(insights.activeDays)
    .map(([day, data]) => ({
      day,
      avgEngagement: Math.round(data.total / data.count),
      posts: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Engagement style (likes vs comments vs shares)
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;

  posts.forEach(post => {
    totalLikes += post.analytics?.likes || 0;
    totalComments += post.analytics?.comments || 0;
    totalShares += post.analytics?.shares || 0;
  });

  const total = totalLikes + totalComments + totalShares;
  const engagementStyle = total > 0 ? {
    likes: Math.round((totalLikes / total) * 100),
    comments: Math.round((totalComments / total) * 100),
    shares: Math.round((totalShares / total) * 100),
    primary: totalLikes > totalComments && totalLikes > totalShares ? 'likes' :
             totalComments > totalShares ? 'comments' : 'shares'
  } : null;

  return {
    activeHours,
    activeDays,
    engagementStyle,
    peakHours: activeHours.slice(0, 3),
    peakDays: activeDays.slice(0, 3)
  };
}

/**
 * Get behavior insights
 */
async function getBehaviorInsights(posts) {
  // Response time patterns
  const responseTimes = [];
  posts.forEach(post => {
    if (post.analytics?.comments && post.analytics.comments > 0) {
      // Estimate response time based on engagement
      const engagement = post.analytics.engagement || 0;
      const comments = post.analytics.comments || 0;
      // Higher comment-to-engagement ratio suggests faster response
      const responseSpeed = comments / engagement;
      responseTimes.push(responseSpeed);
    }
  });

  const avgResponseSpeed = responseTimes.length > 0
    ? responseTimes.reduce((sum, r) => sum + r, 0) / responseTimes.length
    : 0;

  // Content consumption patterns
  const consumptionPatterns = {
    quickEngagement: 0, // High engagement in first hour
    sustainedEngagement: 0, // Engagement over multiple days
    viralContent: 0 // Exponential growth
  };

  // Platform behavior
  const platformBehavior = {};
  posts.forEach(post => {
    const platform = post.platform;
    if (!platformBehavior[platform]) {
      platformBehavior[platform] = {
        avgEngagement: 0,
        avgImpressions: 0,
        engagementRate: 0,
        posts: 0
      };
    }

    const engagement = post.analytics?.engagement || 0;
    const impressions = post.analytics?.impressions || post.analytics?.views || 0;

    platformBehavior[platform].avgEngagement += engagement;
    platformBehavior[platform].avgImpressions += impressions;
    platformBehavior[platform].posts++;
  });

  Object.keys(platformBehavior).forEach(platform => {
    const data = platformBehavior[platform];
    data.avgEngagement = Math.round(data.avgEngagement / data.posts);
    data.avgImpressions = Math.round(data.avgImpressions / data.posts);
    data.engagementRate = data.avgImpressions > 0
      ? Math.round((data.avgEngagement / data.avgImpressions) * 100 * 100) / 100
      : 0;
  });

  return {
    avgResponseSpeed: Math.round(avgResponseSpeed * 1000) / 1000,
    consumptionPatterns,
    platformBehavior,
    engagementVelocity: calculateEngagementVelocity(posts)
  };
}

/**
 * Calculate engagement velocity
 */
function calculateEngagementVelocity(posts) {
  if (posts.length < 2) {
    return { velocity: 0, trend: 'stable' };
  }

  // Sort by posted date
  const sorted = [...posts].sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));

  // Calculate velocity (engagement per day)
  const velocities = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = (new Date(sorted[i].postedAt) - new Date(sorted[i-1].postedAt)) / (1000 * 60 * 60 * 24);
    if (daysDiff > 0) {
      const engagementDiff = (sorted[i].analytics?.engagement || 0) - (sorted[i-1].analytics?.engagement || 0);
      velocities.push(engagementDiff / daysDiff);
    }
  }

  const avgVelocity = velocities.length > 0
    ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
    : 0;

  return {
    velocity: Math.round(avgVelocity * 10) / 10,
    trend: avgVelocity > 0 ? 'increasing' : avgVelocity < 0 ? 'decreasing' : 'stable'
  };
}

/**
 * Get content preferences
 */
async function getContentPreferences(posts) {
  const preferences = {
    contentTypes: {},
    topics: {},
    formats: {},
    length: {}
  };

  posts.forEach(post => {
    if (post.contentId) {
      const content = post.contentId;
      const engagement = post.analytics?.engagement || 0;

      // Content type preference
      const type = content.type || 'unknown';
      if (!preferences.contentTypes[type]) {
        preferences.contentTypes[type] = { total: 0, count: 0 };
      }
      preferences.contentTypes[type].total += engagement;
      preferences.contentTypes[type].count++;

      // Topic preference (from tags)
      if (content.tags) {
        content.tags.forEach(tag => {
          if (!preferences.topics[tag]) {
            preferences.topics[tag] = { total: 0, count: 0 };
          }
          preferences.topics[tag].total += engagement;
          preferences.topics[tag].count++;
        });
      }

      // Category preference
      if (content.category) {
        if (!preferences.topics[content.category]) {
          preferences.topics[content.category] = { total: 0, count: 0 };
        }
        preferences.topics[content.category].total += engagement;
        preferences.topics[content.category].count++;
      }
    }
  });

  // Calculate averages
  const typePreferences = Object.entries(preferences.contentTypes)
    .map(([type, data]) => ({
      type,
      avgEngagement: Math.round(data.total / data.count),
      posts: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const topicPreferences = Object.entries(preferences.topics)
    .map(([topic, data]) => ({
      topic,
      avgEngagement: Math.round(data.total / data.count),
      posts: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 20);

  return {
    preferredTypes: typePreferences,
    preferredTopics: topicPreferences,
    topTopics: topicPreferences.slice(0, 10)
  };
}

/**
 * Get audience growth
 */
async function getAudienceGrowth(posts, period) {
  // Group posts by week
  const weeklyData = {};
  posts.forEach(post => {
    const week = getWeekKey(post.postedAt);
    if (!weeklyData[week]) {
      weeklyData[week] = {
        posts: 0,
        engagement: 0,
        impressions: 0,
        followers: 0 // Estimated from engagement patterns
      };
    }
    weeklyData[week].posts++;
    weeklyData[week].engagement += post.analytics?.engagement || 0;
    weeklyData[week].impressions += post.analytics?.impressions || post.analytics?.views || 0;
  });

  const weeks = Object.entries(weeklyData)
    .map(([week, data]) => ({
      week,
      date: new Date(week.split('-')[0], week.split('-')[1] - 1, week.split('-')[2]),
      ...data,
      avgEngagement: Math.round(data.engagement / data.posts),
      engagementRate: data.impressions > 0
        ? Math.round((data.engagement / data.impressions) * 100 * 100) / 100
        : 0
    }))
    .sort((a, b) => a.date - b.date);

  // Calculate growth rate
  let growthRate = 0;
  if (weeks.length >= 2) {
    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];
    if (firstWeek.avgEngagement > 0) {
      growthRate = ((lastWeek.avgEngagement / firstWeek.avgEngagement) - 1) * 100;
    }
  }

  return {
    weeklyData: weeks,
    growthRate: Math.round(growthRate * 10) / 10,
    trend: growthRate > 5 ? 'growing' : growthRate < -5 ? 'declining' : 'stable',
    totalGrowth: weeks.length >= 2
      ? Math.round((weeks[weeks.length - 1].avgEngagement - weeks[0].avgEngagement) / weeks[0].avgEngagement * 100)
      : 0
  };
}

/**
 * Get week key
 */
function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const week = Math.ceil((d.getDate() + (d.getDay() === 0 ? 7 : d.getDay()) - 1) / 7);
  return `${year}-${month}-${week}`;
}

/**
 * Get audience segments
 */
async function getAudienceSegments(posts) {
  const segments = {
    highEngagers: [],
    casualEngagers: [],
    platformSpecific: {},
    topicEnthusiasts: {}
  };

  // Segment by engagement level
  const engagementLevels = posts.map(post => ({
    post,
    engagement: post.analytics?.engagement || 0
  })).sort((a, b) => b.engagement - a.engagement);

  const threshold = engagementLevels.length > 0
    ? engagementLevels[Math.floor(engagementLevels.length * 0.2)].engagement
    : 0;

  segments.highEngagers = engagementLevels
    .filter(item => item.engagement >= threshold)
    .slice(0, 10)
    .map(item => ({
      contentId: item.post.contentId?._id,
      title: item.post.contentId?.title || 'Untitled',
      platform: item.post.platform,
      engagement: item.engagement
    }));

  segments.casualEngagers = engagementLevels
    .filter(item => item.engagement < threshold)
    .slice(0, 10)
    .map(item => ({
      contentId: item.post.contentId?._id,
      title: item.post.contentId?.title || 'Untitled',
      platform: item.post.platform,
      engagement: item.engagement
    }));

  // Platform-specific segments
  const platforms = [...new Set(posts.map(p => p.platform))];
  platforms.forEach(platform => {
    const platformPosts = posts.filter(p => p.platform === platform);
    const avgEngagement = platformPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / platformPosts.length;
    
    segments.platformSpecific[platform] = {
      posts: platformPosts.length,
      avgEngagement: Math.round(avgEngagement),
      topContent: platformPosts
        .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))
        .slice(0, 5)
        .map(p => ({
          contentId: p.contentId?._id,
          title: p.contentId?.title || 'Untitled',
          engagement: p.analytics?.engagement || 0
        }))
    };
  });

  return segments;
}

/**
 * Generate audience recommendations
 */
function generateAudienceRecommendations(insights) {
  const recommendations = [];

  // Engagement recommendations
  if (insights.engagement.engagementTrend.direction === 'decreasing') {
    recommendations.push('Engagement is declining. Consider posting at optimal times and focusing on high-performing content types.');
  }

  // Platform recommendations
  const platformAverages = Object.entries(insights.engagement.platformAverages)
    .sort((a, b) => b[1] - a[1]);
  
  if (platformAverages.length > 0) {
    const bestPlatform = platformAverages[0][0];
    recommendations.push(`Focus on ${bestPlatform} - it shows the highest average engagement.`);
  }

  // Time recommendations
  if (insights.demographics.peakHours.length > 0) {
    const peakHour = insights.demographics.peakHours[0].hour;
    recommendations.push(`Post around ${peakHour}:00 for maximum engagement based on audience activity patterns.`);
  }

  // Content type recommendations
  if (insights.preferences.preferredTypes.length > 0) {
    const bestType = insights.preferences.preferredTypes[0].type;
    recommendations.push(`Create more ${bestType} content - it performs best with your audience.`);
  }

  // Topic recommendations
  if (insights.preferences.topTopics.length > 0) {
    const topTopic = insights.preferences.topTopics[0].topic;
    recommendations.push(`Focus on ${topTopic} - it generates the most engagement.`);
  }

  // Growth recommendations
  if (insights.growth.trend === 'declining') {
    recommendations.push('Audience growth is declining. Consider diversifying content and increasing posting frequency.');
  }

  return recommendations;
}

/**
 * Predict future audience behavior
 */
async function predictAudienceBehavior(userId, options = {}) {
  try {
    const {
      period = 90,
      forecastDays = 30
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    })
      .sort({ postedAt: 1 })
      .lean();

    if (posts.length < 7) {
      return {
        hasPrediction: false,
        message: 'Insufficient data for prediction'
      };
    }

    // Calculate trends
    const weeklyData = groupByWeek(posts);
    const engagementTrend = calculateTrend(weeklyData.map(w => w.avgEngagement));
    const growthTrend = calculateTrend(weeklyData.map(w => w.engagementRate));

    // Predict future engagement
    const predictions = [];
    const lastWeek = weeklyData[weeklyData.length - 1];
    
    for (let i = 1; i <= Math.ceil(forecastDays / 7); i++) {
      const predictedEngagement = lastWeek.avgEngagement * (1 + (engagementTrend * i / 100));
      const predictedRate = lastWeek.engagementRate * (1 + (growthTrend * i / 100));
      
      predictions.push({
        week: i,
        predictedEngagement: Math.round(predictedEngagement),
        predictedEngagementRate: Math.round(predictedRate * 100) / 100,
        confidence: i <= 2 ? 'high' : i <= 4 ? 'medium' : 'low'
      });
    }

    return {
      hasPrediction: true,
      currentTrend: {
        engagement: engagementTrend,
        growth: growthTrend
      },
      predictions,
      recommendations: generatePredictionRecommendations(engagementTrend, growthTrend)
    };
  } catch (error) {
    logger.error('Error predicting audience behavior', { error: error.message, userId });
    throw error;
  }
}

/**
 * Group posts by week
 */
function groupByWeek(posts) {
  const weeklyData = {};
  
  posts.forEach(post => {
    const week = getWeekKey(post.postedAt);
    if (!weeklyData[week]) {
      weeklyData[week] = { posts: [], engagement: 0, impressions: 0 };
    }
    weeklyData[week].posts.push(post);
    weeklyData[week].engagement += post.analytics?.engagement || 0;
    weeklyData[week].impressions += post.analytics?.impressions || post.analytics?.views || 0;
  });

  return Object.entries(weeklyData).map(([week, data]) => ({
    week,
    posts: data.posts.length,
    avgEngagement: data.posts.length > 0 ? data.engagement / data.posts.length : 0,
    engagementRate: data.impressions > 0 ? (data.engagement / data.impressions) * 100 : 0
  })).sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Calculate trend
 */
function calculateTrend(values) {
  if (values.length < 2) return 0;
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
  
  return firstAvg > 0 ? ((secondAvg / firstAvg) - 1) * 100 : 0;
}

/**
 * Generate prediction recommendations
 */
function generatePredictionRecommendations(engagementTrend, growthTrend) {
  const recommendations = [];

  if (engagementTrend < -10) {
    recommendations.push('Engagement is declining significantly. Consider changing content strategy or posting times.');
  } else if (engagementTrend > 10) {
    recommendations.push('Engagement is growing! Continue current strategy and consider scaling successful content.');
  }

  if (growthTrend < -5) {
    recommendations.push('Growth rate is declining. Focus on audience retention and engagement quality.');
  }

  return recommendations;
}

/**
 * Create audience personas
 */
async function createAudiencePersonas(userId, options = {}) {
  try {
    const {
      period = 90,
      minSegments = 3,
      maxSegments = 5
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    })
      .populate('contentId')
      .lean();

    if (posts.length === 0) {
      return {
        hasPersonas: false,
        message: 'No data available for persona creation'
      };
    }

    // Analyze engagement patterns to create personas
    const personas = {
      highEngagers: {
        name: 'High Engagers',
        description: 'Highly active audience members who engage frequently',
        characteristics: {
          engagementLevel: 'high',
          preferredContent: getTopContentTypes(posts, 'high'),
          preferredTopics: getTopTopics(posts, 'high'),
          activeTimes: getActiveTimes(posts, 'high'),
          preferredPlatforms: getPreferredPlatforms(posts, 'high')
        },
        size: Math.round(posts.length * 0.2),
        value: 'high'
      },
      casualEngagers: {
        name: 'Casual Engagers',
        description: 'Moderate engagement, occasional interaction',
        characteristics: {
          engagementLevel: 'moderate',
          preferredContent: getTopContentTypes(posts, 'moderate'),
          preferredTopics: getTopTopics(posts, 'moderate'),
          activeTimes: getActiveTimes(posts, 'moderate'),
          preferredPlatforms: getPreferredPlatforms(posts, 'moderate')
        },
        size: Math.round(posts.length * 0.5),
        value: 'medium'
      },
      passiveViewers: {
        name: 'Passive Viewers',
        description: 'Low engagement, primarily viewing content',
        characteristics: {
          engagementLevel: 'low',
          preferredContent: getTopContentTypes(posts, 'low'),
          preferredTopics: getTopTopics(posts, 'low'),
          activeTimes: getActiveTimes(posts, 'low'),
          preferredPlatforms: getPreferredPlatforms(posts, 'low')
        },
        size: Math.round(posts.length * 0.3),
        value: 'low'
      }
    };

    return {
      hasPersonas: true,
      personas,
      totalAudience: posts.length,
      recommendations: generatePersonaRecommendations(personas)
    };
  } catch (error) {
    logger.error('Error creating audience personas', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get top content types for segment
 */
function getTopContentTypes(posts, segment) {
  const typeEngagement = {};
  
  posts.forEach(post => {
    if (post.contentId) {
      const type = post.contentId.type || 'unknown';
      const engagement = post.analytics?.engagement || 0;
      
      if (!typeEngagement[type]) {
        typeEngagement[type] = [];
      }
      typeEngagement[type].push(engagement);
    }
  });

  const typeAverages = Object.entries(typeEngagement).map(([type, engagements]) => ({
    type,
    avgEngagement: engagements.reduce((sum, e) => sum + e, 0) / engagements.length
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Filter based on segment
  if (segment === 'high') {
    return typeAverages.slice(0, 3).map(t => t.type);
  } else if (segment === 'moderate') {
    return typeAverages.slice(1, 4).map(t => t.type);
  } else {
    return typeAverages.slice(-3).map(t => t.type);
  }
}

/**
 * Get top topics for segment
 */
function getTopTopics(posts, segment) {
  const topicEngagement = {};
  
  posts.forEach(post => {
    if (post.contentId && post.contentId.tags) {
      post.contentId.tags.forEach(tag => {
        if (!topicEngagement[tag]) {
          topicEngagement[tag] = [];
        }
        topicEngagement[tag].push(post.analytics?.engagement || 0);
      });
    }
  });

  const topicAverages = Object.entries(topicEngagement).map(([topic, engagements]) => ({
    topic,
    avgEngagement: engagements.reduce((sum, e) => sum + e, 0) / engagements.length
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  if (segment === 'high') {
    return topicAverages.slice(0, 5).map(t => t.topic);
  } else if (segment === 'moderate') {
    return topicAverages.slice(2, 7).map(t => t.topic);
  } else {
    return topicAverages.slice(-5).map(t => t.topic);
  }
}

/**
 * Get active times for segment
 */
function getActiveTimes(posts, segment) {
  const hourEngagement = {};
  
  posts.forEach(post => {
    const hour = new Date(post.postedAt).getHours();
    if (!hourEngagement[hour]) {
      hourEngagement[hour] = [];
    }
    hourEngagement[hour].push(post.analytics?.engagement || 0);
  });

  const hourAverages = Object.entries(hourEngagement).map(([hour, engagements]) => ({
    hour: parseInt(hour),
    avgEngagement: engagements.reduce((sum, e) => sum + e, 0) / engagements.length
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  if (segment === 'high') {
    return hourAverages.slice(0, 3).map(h => h.hour);
  } else if (segment === 'moderate') {
    return hourAverages.slice(2, 5).map(h => h.hour);
  } else {
    return hourAverages.slice(-3).map(h => h.hour);
  }
}

/**
 * Get preferred platforms for segment
 */
function getPreferredPlatforms(posts, segment) {
  const platformEngagement = {};
  
  posts.forEach(post => {
    const platform = post.platform;
    if (!platformEngagement[platform]) {
      platformEngagement[platform] = [];
    }
    platformEngagement[platform].push(post.analytics?.engagement || 0);
  });

  const platformAverages = Object.entries(platformEngagement).map(([platform, engagements]) => ({
    platform,
    avgEngagement: engagements.reduce((sum, e) => sum + e, 0) / engagements.length
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  if (segment === 'high') {
    return platformAverages.slice(0, 2).map(p => p.platform);
  } else if (segment === 'moderate') {
    return platformAverages.slice(1, 3).map(p => p.platform);
  } else {
    return platformAverages.slice(-2).map(p => p.platform);
  }
}

/**
 * Generate persona recommendations
 */
function generatePersonaRecommendations(personas) {
  const recommendations = [];

  if (personas.highEngagers.size > personas.passiveViewers.size * 2) {
    recommendations.push('You have a highly engaged audience! Focus on creating premium content for high engagers.');
  } else if (personas.passiveViewers.size > personas.highEngagers.size * 2) {
    recommendations.push('Many passive viewers detected. Create more engaging content to convert them to active engagers.');
  }

  recommendations.push(`Target high engagers with ${personas.highEngagers.characteristics.preferredContent.join(', ')} content.`);
  recommendations.push(`Post at ${personas.highEngagers.characteristics.activeTimes.join(', ')} for maximum engagement.`);

  return recommendations;
}

/**
 * Analyze audience sentiment
 */
async function analyzeAudienceSentiment(userId, options = {}) {
  try {
    const {
      period = 30
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate },
      'analytics.comments': { $gt: 0 }
    }).lean();

    if (posts.length === 0) {
      return {
        hasSentiment: false,
        message: 'No comments available for sentiment analysis'
      };
    }

    // Analyze sentiment based on engagement patterns
    // In production, use NLP/AI for actual sentiment analysis
    const sentiment = {
      positive: 0,
      neutral: 0,
      negative: 0,
      overall: 'neutral'
    };

    posts.forEach(post => {
      const engagement = post.analytics?.engagement || 0;
      const comments = post.analytics?.comments || 0;
      const likes = post.analytics?.likes || 0;
      const shares = post.analytics?.shares || 0;

      // Simple sentiment scoring
      const sentimentScore = (likes * 2 + shares * 3 + comments) / (comments + 1);
      
      if (sentimentScore > 5) {
        sentiment.positive++;
      } else if (sentimentScore < 2) {
        sentiment.negative++;
      } else {
        sentiment.neutral++;
      }
    });

    const total = sentiment.positive + sentiment.neutral + sentiment.negative;
    if (total > 0) {
      sentiment.positive = Math.round((sentiment.positive / total) * 100);
      sentiment.neutral = Math.round((sentiment.neutral / total) * 100);
      sentiment.negative = Math.round((sentiment.negative / total) * 100);

      if (sentiment.positive > 50) {
        sentiment.overall = 'positive';
      } else if (sentiment.negative > 30) {
        sentiment.overall = 'negative';
      } else {
        sentiment.overall = 'neutral';
      }
    }

    return {
      hasSentiment: true,
      sentiment,
      totalPosts: posts.length,
      recommendations: generateSentimentRecommendations(sentiment)
    };
  } catch (error) {
    logger.error('Error analyzing sentiment', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate sentiment recommendations
 */
function generateSentimentRecommendations(sentiment) {
  const recommendations = [];

  if (sentiment.overall === 'positive') {
    recommendations.push('Audience sentiment is positive! Continue creating similar content.');
  } else if (sentiment.overall === 'negative') {
    recommendations.push('Negative sentiment detected. Review content and consider adjusting strategy.');
  } else {
    recommendations.push('Neutral sentiment. Experiment with different content types to increase engagement.');
  }

  return recommendations;
}

/**
 * Identify top influencers/engagers
 */
async function identifyInfluencers(userId, options = {}) {
  try {
    const {
      period = 90,
      topN = 10
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    })
      .populate('contentId')
      .sort({ 'analytics.engagement': -1 })
      .limit(topN * 3)
      .lean();

    // Identify content that drives high engagement (potential influencers)
    const influencers = posts
      .filter(post => (post.analytics?.engagement || 0) > 0)
      .map(post => ({
        contentId: post.contentId?._id,
        title: post.contentId?.title || 'Untitled',
        platform: post.platform,
        engagement: post.analytics?.engagement || 0,
        impressions: post.analytics?.impressions || post.analytics?.views || 0,
        engagementRate: (post.analytics?.impressions || post.analytics?.views || 0) > 0
          ? ((post.analytics?.engagement || 0) / (post.analytics?.impressions || post.analytics?.views || 0)) * 100
          : 0,
        shares: post.analytics?.shares || 0,
        comments: post.analytics?.comments || 0,
        postedAt: post.postedAt
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, topN);

    return {
      influencers,
      total: influencers.length,
      topInfluencer: influencers[0] || null,
      recommendations: generateInfluencerRecommendations(influencers)
    };
  } catch (error) {
    logger.error('Error identifying influencers', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate influencer recommendations
 */
function generateInfluencerRecommendations(influencers) {
  const recommendations = [];

  if (influencers.length > 0) {
    const topPlatform = influencers.reduce((acc, inf) => {
      acc[inf.platform] = (acc[inf.platform] || 0) + 1;
      return acc;
    }, {});

    const mostCommonPlatform = Object.entries(topPlatform)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (mostCommonPlatform) {
      recommendations.push(`Focus on ${mostCommonPlatform} - it generates the most high-engagement content.`);
    }

    recommendations.push('Create more content similar to your top performers to maximize engagement.');
  }

  return recommendations;
}

/**
 * Analyze audience retention
 */
async function analyzeAudienceRetention(userId, options = {}) {
  try {
    const {
      period = 90
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    })
      .sort({ postedAt: 1 })
      .lean();

    if (posts.length < 7) {
      return {
        hasRetention: false,
        message: 'Insufficient data for retention analysis'
      };
    }

    // Group by week
    const weeklyData = groupByWeek(posts);
    
    // Calculate retention (engagement consistency)
    const retentionRates = [];
    for (let i = 1; i < weeklyData.length; i++) {
      const prevEngagement = weeklyData[i - 1].avgEngagement;
      const currEngagement = weeklyData[i].avgEngagement;
      
      if (prevEngagement > 0) {
        const retention = (currEngagement / prevEngagement) * 100;
        retentionRates.push(retention);
      }
    }

    const avgRetention = retentionRates.length > 0
      ? retentionRates.reduce((sum, r) => sum + r, 0) / retentionRates.length
      : 100;

    // Calculate churn (declining engagement)
    const churnRate = avgRetention < 80 ? 100 - avgRetention : 0;

    return {
      hasRetention: true,
      avgRetention: Math.round(avgRetention * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      retentionTrend: avgRetention >= 90 ? 'excellent' : avgRetention >= 75 ? 'good' : avgRetention >= 60 ? 'fair' : 'poor',
      weeklyRetention: retentionRates,
      recommendations: generateRetentionRecommendations(avgRetention, churnRate)
    };
  } catch (error) {
    logger.error('Error analyzing retention', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate retention recommendations
 */
function generateRetentionRecommendations(avgRetention, churnRate) {
  const recommendations = [];

  if (avgRetention < 70) {
    recommendations.push('Retention is low. Focus on consistent posting and engaging content to retain audience.');
  } else if (avgRetention >= 90) {
    recommendations.push('Excellent retention! Your audience is highly engaged and loyal.');
  }

  if (churnRate > 30) {
    recommendations.push('High churn rate detected. Review content strategy and posting frequency.');
  }

  return recommendations;
}

/**
 * Get cross-platform deep analysis
 */
async function getCrossPlatformAnalysis(userId, options = {}) {
  try {
    const {
      period = 90
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    if (posts.length === 0) {
      return {
        hasAnalysis: false,
        message: 'No data available for cross-platform analysis'
      };
    }

    // Group by platform
    const platformData = {};
    posts.forEach(post => {
      if (!platformData[post.platform]) {
        platformData[post.platform] = {
          posts: [],
          totalEngagement: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalShares: 0,
          totalComments: 0,
          totalLikes: 0
        };
      }

      platformData[post.platform].posts.push(post);
      platformData[post.platform].totalEngagement += post.analytics?.engagement || 0;
      platformData[post.platform].totalImpressions += post.analytics?.impressions || post.analytics?.views || 0;
      platformData[post.platform].totalClicks += post.analytics?.clicks || 0;
      platformData[post.platform].totalShares += post.analytics?.shares || 0;
      platformData[post.platform].totalComments += post.analytics?.comments || 0;
      platformData[post.platform].totalLikes += post.analytics?.likes || 0;
    });

    // Calculate metrics per platform
    const platformMetrics = {};
    Object.entries(platformData).forEach(([platform, data]) => {
      const postCount = data.posts.length;
      platformMetrics[platform] = {
        posts: postCount,
        avgEngagement: Math.round(data.totalEngagement / postCount),
        avgImpressions: Math.round(data.totalImpressions / postCount),
        engagementRate: data.totalImpressions > 0
          ? Math.round((data.totalEngagement / data.totalImpressions) * 100 * 100) / 100
          : 0,
        clickThroughRate: data.totalImpressions > 0
          ? Math.round((data.totalClicks / data.totalImpressions) * 100 * 100) / 100
          : 0,
        shareRate: data.totalEngagement > 0
          ? Math.round((data.totalShares / data.totalEngagement) * 100 * 100) / 100
          : 0,
        commentRate: data.totalEngagement > 0
          ? Math.round((data.totalComments / data.totalEngagement) * 100 * 100) / 100
          : 0
      };
    });

    // Find best platform
    const bestPlatform = Object.entries(platformMetrics)
      .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)[0]?.[0];

    return {
      hasAnalysis: true,
      platformMetrics,
      bestPlatform,
      totalPlatforms: Object.keys(platformMetrics).length,
      recommendations: generateCrossPlatformRecommendations(platformMetrics, bestPlatform)
    };
  } catch (error) {
    logger.error('Error getting cross-platform analysis', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate cross-platform recommendations
 */
function generateCrossPlatformRecommendations(platformMetrics, bestPlatform) {
  const recommendations = [];

  if (bestPlatform) {
    recommendations.push(`Focus on ${bestPlatform} - it shows the best engagement metrics.`);
  }

  const platforms = Object.keys(platformMetrics);
  if (platforms.length < 3) {
    recommendations.push('Consider diversifying across more platforms to reach broader audiences.');
  }

  return recommendations;
}

module.exports = {
  getAudienceInsights,
  predictAudienceBehavior,
  createAudiencePersonas,
  analyzeAudienceSentiment,
  identifyInfluencers,
  analyzeAudienceRetention,
  getCrossPlatformAnalysis
};

