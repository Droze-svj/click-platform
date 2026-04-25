// Advanced Video Analytics Service

const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Get engagement heatmap
 */
async function getEngagementHeatmap(videoId, userId) {
  try {
    const content = await Content.findOne({
      _id: videoId,
      userId,
      type: 'video',
    }).lean();

    if (!content) {
      throw new Error('Video not found');
    }

    // In production, analyze actual watch data
    // For now, generate sample heatmap
    const duration = content.originalFile?.duration || 60;
    const segments = Math.ceil(duration / 5); // 5-second segments

    const heatmap = [];
    for (let i = 0; i < segments; i++) {
      const startTime = i * 5;
      const endTime = Math.min((i + 1) * 5, duration);
      
      // Simulate engagement (higher at start, dips in middle, peaks at end)
      const engagement = Math.max(0.3, Math.min(1.0, 
        0.9 - (Math.abs(i - segments/2) / segments) * 0.4 + Math.random() * 0.2
      ));

      heatmap.push({
        startTime,
        endTime,
        engagement: Math.round(engagement * 100) / 100,
        views: Math.floor(engagement * 100),
        retention: Math.round(engagement * 100),
      });
    }

    logger.info('Engagement heatmap generated', { videoId, segments: heatmap.length });
    return {
      videoId,
      duration,
      heatmap,
      averageEngagement: heatmap.reduce((sum, h) => sum + h.engagement, 0) / heatmap.length,
    };
  } catch (error) {
    logger.error('Get engagement heatmap error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get watch time analytics
 */
async function getWatchTimeAnalytics(videoId, userId) {
  try {
    const content = await Content.findOne({
      _id: videoId,
      userId,
      type: 'video',
    }).lean();

    if (!content) {
      throw new Error('Video not found');
    }

    const duration = content.originalFile?.duration || 60;
    const totalViews = content.views || 0;

    // Calculate watch time metrics
    const averageWatchTime = duration * 0.65; // 65% average retention
    const totalWatchTime = averageWatchTime * totalViews;
    const completionRate = 0.65;
    const dropOffPoints = [
      { time: 5, percentage: 0.1 },
      { time: 15, percentage: 0.25 },
      { time: 30, percentage: 0.4 },
      { time: duration * 0.5, percentage: 0.55 },
    ];

    return {
      videoId,
      duration,
      totalViews,
      averageWatchTime: Math.round(averageWatchTime),
      totalWatchTime: Math.round(totalWatchTime),
      completionRate: Math.round(completionRate * 100) / 100,
      dropOffPoints,
      retentionCurve: generateRetentionCurve(duration),
    };
  } catch (error) {
    logger.error('Get watch time analytics error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Generate retention curve
 */
function generateRetentionCurve(duration) {
  const points = [];
  const segments = 20;

  for (let i = 0; i <= segments; i++) {
    const time = (i / segments) * duration;
    // Retention typically drops over time
    const retention = Math.max(0.1, 1.0 - (i / segments) * 0.6 + Math.random() * 0.1);
    
    points.push({
      time: Math.round(time),
      retention: Math.round(retention * 100) / 100,
    });
  }

  return points;
}

/**
 * Get audience insights
 */
async function getAudienceInsights(videoId, userId) {
  try {
    const content = await Content.findOne({
      _id: videoId,
      userId,
      type: 'video',
    }).lean();

    if (!content) {
      throw new Error('Video not found');
    }

    // In production, analyze actual audience data
    const insights = {
      videoId,
      demographics: {
        ageGroups: {
          '18-24': 0.25,
          '25-34': 0.35,
          '35-44': 0.20,
          '45-54': 0.12,
          '55+': 0.08,
        },
        genders: {
          male: 0.45,
          female: 0.50,
          other: 0.05,
        },
        locations: {
          'United States': 0.40,
          'United Kingdom': 0.15,
          'Canada': 0.10,
          'Australia': 0.08,
          'Other': 0.27,
        },
      },
      devices: {
        mobile: 0.60,
        desktop: 0.30,
        tablet: 0.10,
      },
      platforms: {
        youtube: 0.50,
        instagram: 0.25,
        facebook: 0.15,
        tiktok: 0.10,
      },
      watchBehavior: {
        averageSessionDuration: 45,
        replayRate: 0.15,
        shareRate: 0.08,
        commentRate: 0.05,
      },
    };

    logger.info('Audience insights generated', { videoId });
    return insights;
  } catch (error) {
    logger.error('Get audience insights error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get video performance comparison
 */
async function compareVideoPerformance(videoIds, userId) {
  try {
    const videos = await Content.find({
      _id: { $in: videoIds },
      userId,
      type: 'video',
    })
      .select('title views likes shares comments createdAt originalFile')
      .lean();

    const comparison = videos.map(video => {
      const duration = video.originalFile?.duration || 60;
      const views = video.views || 0;
      const likes = video.likes || 0;
      const shares = video.shares || 0;
      const comments = video.comments || 0;

      const engagement = likes + shares * 2 + comments * 3;
      const engagementRate = views > 0 ? (engagement / views) * 100 : 0;
      const averageWatchTime = duration * 0.65;
      const completionRate = 0.65;

      return {
        videoId: video._id,
        title: video.title,
        duration,
        views,
        likes,
        shares,
        comments,
        engagement,
        engagementRate: Math.round(engagementRate * 100) / 100,
        averageWatchTime: Math.round(averageWatchTime),
        completionRate: Math.round(completionRate * 100) / 100,
        createdAt: video.createdAt,
      };
    });

    // Sort by engagement rate
    comparison.sort((a, b) => b.engagementRate - a.engagementRate);

    logger.info('Video performance compared', { videoIds: videoIds.length });
    return {
      videos: comparison,
      bestPerformer: comparison[0],
      averageEngagementRate: comparison.reduce((sum, v) => sum + v.engagementRate, 0) / comparison.length,
    };
  } catch (error) {
    logger.error('Compare video performance error', { error: error.message });
    throw error;
  }
}

module.exports = {
  getEngagementHeatmap,
  getWatchTimeAnalytics,
  getAudienceInsights,
  compareVideoPerformance,
};






