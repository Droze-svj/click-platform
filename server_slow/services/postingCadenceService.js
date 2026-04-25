// Posting Cadence Service
// Analyze posting frequency and content mix

const PostingCadence = require('../models/PostingCadence');
const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const logger = require('../utils/logger');

/**
 * Analyze posting cadence
 */
async function analyzePostingCadence(workspaceId, period, filters = {}) {
  try {
    const {
      platform = null
    } = filters;

    const {
      type = 'weekly',
      startDate,
      endDate
    } = period;

    // Get posts for period
    const postQuery = {
      workspaceId,
      status: 'posted',
      postedAt: { $gte: startDate, $lte: endDate }
    };
    if (platform) postQuery.platform = platform;

    const posts = await ScheduledPost.find(postQuery)
      .populate('contentId')
      .sort({ postedAt: 1 })
      .lean();

    // Get content performance
    const performanceQuery = {
      workspaceId,
      postedAt: { $gte: startDate, $lte: endDate }
    };
    if (platform) performanceQuery.platform = platform;

    const performances = await ContentPerformance.find(performanceQuery).lean();

    // Calculate frequency
    const totalPosts = posts.length;
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const postsPerDay = daysDiff > 0 ? totalPosts / daysDiff : 0;
    const postsPerWeek = postsPerDay * 7;

    // Calculate consistency
    const postingDays = new Set(posts.map(p => p.postedAt.toISOString().split('T')[0])).size;
    const consistency = daysDiff > 0 ? (postingDays / daysDiff) * 100 : 0;

    // Calculate average days between posts
    let averageDaysBetween = 0;
    if (posts.length > 1) {
      let totalDaysBetween = 0;
      for (let i = 1; i < posts.length; i++) {
        const daysBetween = (posts[i].postedAt - posts[i - 1].postedAt) / (1000 * 60 * 60 * 24);
        totalDaysBetween += daysBetween;
      }
      averageDaysBetween = totalDaysBetween / (posts.length - 1);
    }

    // Analyze content mix
    const contentMix = analyzeContentMix(posts);

    // Calculate performance correlation
    const correlation = await calculatePerformanceCorrelation(
      workspaceId,
      platform,
      { posts, performances },
      { frequency: postsPerWeek, mix: contentMix }
    );

    // Determine optimal cadence
    const optimal = await determineOptimalCadence(
      workspaceId,
      platform,
      { posts, performances }
    );

    // Create or update cadence record
    const cadence = await PostingCadence.findOneAndUpdate(
      {
        workspaceId,
        platform: platform || 'all',
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type
      },
      {
        $set: {
          workspaceId,
          platform: platform || 'all',
          period: {
            type,
            startDate,
            endDate
          },
          frequency: {
            totalPosts,
            postsPerDay,
            postsPerWeek,
            averageDaysBetween,
            consistency
          },
          contentMix,
          correlation,
          optimal
        }
      },
      { upsert: true, new: true }
    );

    return cadence;
  } catch (error) {
    logger.error('Error analyzing posting cadence', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Analyze content mix
 */
function analyzeContentMix(posts) {
  const formats = {};
  const types = {};
  const topics = {};

  posts.forEach(post => {
    const content = post.contentId || {};
    const format = detectFormat(post, content);
    const type = content.type || 'post';

    // Formats
    if (!formats[format]) {
      formats[format] = 0;
    }
    formats[format]++;

    // Types
    if (!types[type]) {
      types[type] = 0;
    }
    types[type]++;

    // Topics
    const postTopics = extractTopics(post, content);
    postTopics.forEach(topic => {
      if (!topics[topic]) {
        topics[topic] = 0;
      }
      topics[topic]++;
    });
  });

  const total = posts.length;

  return {
    formats: Object.entries(formats).map(([format, count]) => ({
      format,
      count,
      percentage: (count / total) * 100
    })),
    types: Object.entries(types).map(([type, count]) => ({
      type,
      count,
      percentage: (count / total) * 100
    })),
    topics: Object.entries(topics)
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 topics
  };
}

/**
 * Calculate performance correlation
 */
async function calculatePerformanceCorrelation(workspaceId, platform, data, cadence) {
  const { posts, performances } = data;

  // Group posts by week to analyze frequency correlation
  const weeklyData = {};
  posts.forEach(post => {
    const week = getWeekKey(post.postedAt);
    if (!weeklyData[week]) {
      weeklyData[week] = { posts: 0, engagement: 0, clicks: 0, conversions: 0 };
    }
    weeklyData[week].posts++;

    const performance = performances.find(p => p.postId.toString() === post._id.toString());
    if (performance) {
      weeklyData[week].engagement += performance.performance.engagement || 0;
      weeklyData[week].clicks += performance.performance.clicks || 0;
      weeklyData[week].conversions += performance.performance.conversions || 0;
    }
  });

  // Calculate correlation (simplified Pearson correlation)
  const weeks = Object.values(weeklyData);
  if (weeks.length < 2) {
    return {
      frequencyToEngagement: 0,
      frequencyToClicks: 0,
      frequencyToConversions: 0,
      mixToPerformance: {
        bestFormat: null,
        bestType: null,
        bestTopic: null,
        correlationScore: 0
      }
    };
  }

  const frequencyToEngagement = calculateCorrelation(
    weeks.map(w => w.posts),
    weeks.map(w => w.engagement)
  );

  const frequencyToClicks = calculateCorrelation(
    weeks.map(w => w.posts),
    weeks.map(w => w.clicks)
  );

  const frequencyToConversions = calculateCorrelation(
    weeks.map(w => w.posts),
    weeks.map(w => w.conversions)
  );

  // Find best performing format/type/topic
  const formatPerformance = {};
  const typePerformance = {};
  const topicPerformance = {};

  performances.forEach(perf => {
    const format = perf.content?.format || 'unknown';
    const type = perf.content?.type || 'unknown';
    const topics = perf.content?.topics || [];

    if (!formatPerformance[format]) {
      formatPerformance[format] = { count: 0, totalScore: 0 };
    }
    formatPerformance[format].count++;
    formatPerformance[format].totalScore += perf.scores.overall || 0;

    if (!typePerformance[type]) {
      typePerformance[type] = { count: 0, totalScore: 0 };
    }
    typePerformance[type].count++;
    typePerformance[type].totalScore += perf.scores.overall || 0;

    topics.forEach(topic => {
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { count: 0, totalScore: 0 };
      }
      topicPerformance[topic].count++;
      topicPerformance[topic].totalScore += perf.scores.overall || 0;
    });
  });

  const bestFormat = Object.entries(formatPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0]?.[0];

  const bestType = Object.entries(typePerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0]?.[0];

  const bestTopic = Object.entries(topicPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))[0]?.[0];

  return {
    frequencyToEngagement,
    frequencyToClicks,
    frequencyToConversions,
    mixToPerformance: {
      bestFormat,
      bestType,
      bestTopic,
      correlationScore: 0.7 // Placeholder
    }
  };
}

/**
 * Determine optimal cadence
 */
async function determineOptimalCadence(workspaceId, platform, data) {
  const { posts, performances } = data;

  // Analyze best performing weeks
  const weeklyPerformance = {};
  posts.forEach(post => {
    const week = getWeekKey(post.postedAt);
    if (!weeklyPerformance[week]) {
      weeklyPerformance[week] = { posts: 0, totalScore: 0 };
    }
    weeklyPerformance[week].posts++;

    const performance = performances.find(p => p.postId.toString() === post._id.toString());
    if (performance) {
      weeklyPerformance[week].totalScore += performance.scores.overall || 0;
    }
  });

  // Find optimal posting frequency
  const optimalWeeks = Object.entries(weeklyPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].posts) - (a[1].totalScore / a[1].posts))
    .slice(0, 3);

  const recommendedPostsPerWeek = optimalWeeks.length > 0
    ? Math.round(optimalWeeks.reduce((sum, w) => sum + w[1].posts, 0) / optimalWeeks.length)
    : 3;

  // Analyze best performing formats/types
  const formatPerformance = {};
  const typePerformance = {};

  performances.forEach(perf => {
    const format = perf.content?.format || 'unknown';
    const type = perf.content?.type || 'unknown';

    if (!formatPerformance[format]) {
      formatPerformance[format] = { count: 0, totalScore: 0 };
    }
    formatPerformance[format].count++;
    formatPerformance[format].totalScore += perf.scores.overall || 0;

    if (!typePerformance[type]) {
      typePerformance[type] = { count: 0, totalScore: 0 };
    }
    typePerformance[type].count++;
    typePerformance[type].totalScore += perf.scores.overall || 0;
  });

  const recommendedMix = {
    formats: Object.entries(formatPerformance)
      .map(([format, data]) => ({
        format,
        percentage: (data.totalScore / data.count) / 100 * 50 // Simplified
      }))
      .slice(0, 3),
    types: Object.entries(typePerformance)
      .map(([type, data]) => ({
        type,
        percentage: (data.totalScore / data.count) / 100 * 50 // Simplified
      }))
      .slice(0, 3)
  };

  // Analyze best posting days/times
  const dayPerformance = {};
  const hourPerformance = {};

  posts.forEach(post => {
    const day = new Date(post.postedAt).toLocaleDateString('en-US', { weekday: 'long' });
    const hour = new Date(post.postedAt).getHours();

    if (!dayPerformance[day]) {
      dayPerformance[day] = { count: 0, totalScore: 0 };
    }
    dayPerformance[day].count++;

    const performance = performances.find(p => p.postId.toString() === post._id.toString());
    if (performance) {
      dayPerformance[day].totalScore += performance.scores.overall || 0;
    }

    if (!hourPerformance[hour]) {
      hourPerformance[hour] = { count: 0, totalScore: 0 };
    }
    hourPerformance[hour].count++;
    if (performance) {
      hourPerformance[hour].totalScore += performance.scores.overall || 0;
    }
  });

  const bestPostingDays = Object.entries(dayPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))
    .slice(0, 3)
    .map(([day]) => day);

  const bestPostingTimes = Object.entries(hourPerformance)
    .sort((a, b) => (b[1].totalScore / b[1].count) - (a[1].totalScore / a[1].count))
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  return {
    recommendedPostsPerWeek,
    recommendedMix,
    bestPostingDays,
    bestPostingTimes
  };
}

/**
 * Calculate correlation coefficient
 */
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Get week key
 */
function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${week}`;
}

/**
 * Detect format
 */
function detectFormat(post, content) {
  if (content.type === 'video') return 'video';
  if (post.content?.mediaUrl) return 'image';
  if (post.content?.text && post.content?.mediaUrl) return 'link';
  return 'text';
}

/**
 * Extract topics
 */
function extractTopics(post, content) {
  const topics = [];
  if (post.content?.hashtags) topics.push(...post.content.hashtags);
  if (content.tags) topics.push(...content.tags);
  if (content.category) topics.push(content.category);
  return [...new Set(topics)];
}

module.exports = {
  analyzePostingCadence
};


