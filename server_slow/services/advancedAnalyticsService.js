// Advanced Analytics Service
// Heatmap, best times, gap analysis, ROI calculator

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Get performance heatmap data
 */
async function getPerformanceHeatmap(userId, period = 30) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    const heatmap = posts.map(post => {
      const postedAt = new Date(post.postedAt);
      return {
        date: postedAt.toISOString().split('T')[0],
        hour: postedAt.getHours(),
        engagement: post.analytics?.engagement || 0,
        posts: 1
      };
    });

    // Aggregate by date and hour
    const aggregated = {};
    heatmap.forEach(item => {
      const key = `${item.date}-${item.hour}`;
      if (!aggregated[key]) {
        aggregated[key] = { date: item.date, hour: item.hour, engagement: 0, posts: 0 };
      }
      aggregated[key].engagement += item.engagement;
      aggregated[key].posts += item.posts;
    });

    return {
      heatmap: Object.values(aggregated)
    };
  } catch (error) {
    logger.error('Error getting heatmap', { error: error.message, userId });
    return { heatmap: [] };
  }
}

/**
 * Get best times to post
 */
async function getBestTimesToPost(userId, platform = 'all') {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);

    const query = {
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    };

    if (platform !== 'all') {
      query.platform = platform;
    }

    const posts = await ScheduledPost.find(query).lean();

    // Group by day and hour
    const timeStats = {};
    posts.forEach(post => {
      const postedAt = new Date(post.postedAt);
      const day = postedAt.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = postedAt.getHours();
      const key = `${day}-${hour}`;

      if (!timeStats[key]) {
        timeStats[key] = {
          day,
          hour,
          engagement: 0,
          posts: 0
        };
      }

      timeStats[key].engagement += post.analytics?.engagement || 0;
      timeStats[key].posts += 1;
    });

    // Calculate scores (engagement per post)
    const bestTimes = Object.values(timeStats).map(stat => ({
      ...stat,
      score: stat.posts > 0 ? stat.engagement / stat.posts : 0
    })).sort((a, b) => b.score - a.score);

    return {
      bestTimes
    };
  } catch (error) {
    logger.error('Error getting best times', { error: error.message, userId });
    return { bestTimes: [] };
  }
}

/**
 * Get content gap analysis
 */
async function getContentGapAnalysis(userId) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    const contents = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const gaps = [];

    // Platform gap analysis
    const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
    const platformCounts = {};
    posts.forEach(post => {
      platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
    });

    platforms.forEach(platform => {
      const count = platformCounts[platform] || 0;
      if (count < 5) {
        gaps.push({
          type: 'platform',
          title: `Low Activity on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
          description: `You've only posted ${count} times on ${platform} in the last 30 days.`,
          impact: count === 0 ? 'high' : 'medium',
          opportunity: `Increase posting frequency on ${platform} to reach a wider audience.`,
          current: count,
          recommended: 10,
          potential: `+${((10 - count) * 50).toFixed(0)}% engagement potential`
        });
      }
    });

    // Content type gap analysis
    const typeCounts = {};
    contents.forEach(content => {
      typeCounts[content.type] = (typeCounts[content.type] || 0) + 1;
    });

    const totalContents = contents.length;
    if (totalContents > 0) {
      Object.keys(typeCounts).forEach(type => {
        const percentage = (typeCounts[type] / totalContents) * 100;
        if (percentage < 20 && totalContents > 10) {
          gaps.push({
            type: 'content_type',
            title: `Diversify ${type} Content`,
            description: `Only ${percentage.toFixed(0)}% of your content is ${type}. Diversifying can improve engagement.`,
            impact: 'medium',
            opportunity: `Create more ${type} content to appeal to different audience preferences.`,
            current: typeCounts[type],
            recommended: Math.ceil(totalContents * 0.25),
            potential: `+${((Math.ceil(totalContents * 0.25) - typeCounts[type]) * 10).toFixed(0)}% engagement potential`
          });
        }
      });
    }

    // Posting frequency gap
    const postsPerWeek = posts.length / 4;
    if (postsPerWeek < 3) {
      gaps.push({
        type: 'frequency',
        title: 'Increase Posting Frequency',
        description: `You're posting ${postsPerWeek.toFixed(1)} times per week. Industry best practice is 5-7 posts per week.`,
        impact: 'high',
        opportunity: 'Increasing posting frequency can significantly boost engagement and reach.',
        current: Math.round(postsPerWeek),
        recommended: 5,
        potential: `+${((5 - postsPerWeek) * 15).toFixed(0)}% engagement potential`
      });
    }

    return { gaps };
  } catch (error) {
    logger.error('Error getting gap analysis', { error: error.message, userId });
    return { gaps: [] };
  }
}

/**
 * Calculate ROI
 */
async function calculateROI(userId, period = 30, hourlyRate = 50) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    const contents = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    // Calculate metrics
    const totalEngagement = posts.reduce((sum, post) => 
      sum + (post.analytics?.engagement || 0), 0
    );
    const totalReach = posts.reduce((sum, post) => 
      sum + (post.analytics?.impressions || post.analytics?.views || 0), 0
    );
    const totalPosts = posts.length;

    // Estimate time spent (assume 30 min per content, 5 min per post)
    const timeSpent = (contents.length * 0.5) + (posts.length * 0.083);
    const totalCost = timeSpent * hourlyRate;

    // Estimate value (industry averages: $0.10 per engagement, $0.01 per reach)
    const estimatedValue = (totalEngagement * 0.10) + (totalReach * 0.01);
    const roi = totalCost > 0 ? ((estimatedValue - totalCost) / totalCost) * 100 : 0;

    const costPerEngagement = totalEngagement > 0 ? totalCost / totalEngagement : 0;
    const costPerReach = totalReach > 0 ? totalCost / totalReach : 0;

    // Generate recommendations
    const recommendations = [];

    if (roi < 0) {
      recommendations.push({
        title: 'Improve Content Quality',
        description: 'Your ROI is negative. Focus on creating higher-quality content that drives more engagement.',
        potentialIncrease: '+50% ROI'
      });
    }

    if (costPerEngagement > 0.50) {
      recommendations.push({
        title: 'Optimize Posting Times',
        description: 'Your cost per engagement is high. Post at optimal times to improve engagement rates.',
        potentialIncrease: '-30% cost per engagement'
      });
    }

    if (totalPosts < period * 0.5) {
      recommendations.push({
        title: 'Increase Posting Frequency',
        description: `You're posting less than once per day. Increasing frequency can improve ROI.`,
        potentialIncrease: '+25% ROI'
      });
    }

    return {
      totalEngagement,
      totalReach,
      totalPosts,
      estimatedValue,
      timeSpent,
      totalCost,
      costPerEngagement,
      costPerReach,
      roi,
      recommendations
    };
  } catch (error) {
    logger.error('Error calculating ROI', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getPerformanceHeatmap,
  getBestTimesToPost,
  getContentGapAnalysis,
  calculateROI
};


