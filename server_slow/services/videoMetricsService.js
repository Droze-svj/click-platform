// Video Metrics Service
// Track video-specific metrics

const VideoMetrics = require('../models/VideoMetrics');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Update video metrics
 */
async function updateVideoMetrics(postId, metricsData) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post) {
      throw new Error('Post not found');
    }

    const {
      views,
      watchTime,
      completion,
      retention,
      engagement
    } = metricsData;

    // Determine video type
    const content = post.contentId || {};
    const videoDuration = content.originalFile?.duration || metricsData.duration || 0;
    const videoType = videoDuration <= 60 ? 'short_form' : 'long_form';

    // Calculate view-through rate
    const impressions = post.analytics?.impressions || 0;
    const viewThroughRate = impressions > 0 ? ((views?.total || 0) / impressions) * 100 : 0;

    // Update or create video metrics
    const videoMetrics = await VideoMetrics.findOneAndUpdate(
      { postId },
      {
        $set: {
          postId,
          contentId: post.contentId?._id,
          workspaceId: post.workspaceId,
          platform: post.platform,
          video: {
            duration: videoDuration,
            type: videoType,
            format: metricsData.format || 'vertical'
          },
          views: {
            total: views?.total || 0,
            unique: views?.unique || 0,
            organic: views?.organic || 0,
            paid: views?.paid || 0
          },
          watchTime: {
            total: watchTime?.total || 0,
            average: watchTime?.average || 0,
            percentage: videoDuration > 0 ? ((watchTime?.average || 0) / videoDuration) * 100 : 0
          },
          completion: {
            rate: views?.total > 0 ? ((completion?.count || 0) / views.total) * 100 : 0,
            count: completion?.count || 0,
            averageCompletionTime: completion?.averageTime || 0
          },
          viewThroughRate,
          retention: {
            curve: retention?.curve || [],
            averageRetention: 0,
            peakRetention: 0,
            dropOffPoints: retention?.dropOffPoints || []
          },
          engagement: {
            likes: engagement?.likes || 0,
            comments: engagement?.comments || 0,
            shares: engagement?.shares || 0,
            saves: engagement?.saves || 0
          },
          lastUpdated: new Date(),
          syncedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Video metrics updated', { postId, videoType, viewThroughRate });
    return videoMetrics;
  } catch (error) {
    logger.error('Error updating video metrics', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get video metrics analytics
 */
async function getVideoMetricsAnalytics(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null,
      videoType = null // 'short_form' or 'long_form'
    } = filters;

    const query = { workspaceId };
    if (platform) query.platform = platform;
    if (videoType) query['video.type'] = videoType;
    if (startDate || endDate) {
      query.lastUpdated = {};
      if (startDate) query.lastUpdated.$gte = new Date(startDate);
      if (endDate) query.lastUpdated.$lte = new Date(endDate);
    }

    const videos = await VideoMetrics.find(query).lean();

    const analytics = {
      totalVideos: videos.length,
      totalViews: 0,
      averageViewThroughRate: 0,
      averageCompletionRate: 0,
      averageWatchTime: 0,
      averageRetention: 0,
      byType: {
        short_form: { count: 0, metrics: {} },
        long_form: { count: 0, metrics: {} }
      },
      byPlatform: {},
      topPerformers: []
    };

    let totalViewThroughRate = 0;
    let totalCompletionRate = 0;
    let totalWatchTime = 0;
    let totalRetention = 0;
    let videosWithData = 0;

    videos.forEach(video => {
      analytics.totalViews += video.views.total || 0;

      if (video.viewThroughRate > 0) {
        totalViewThroughRate += video.viewThroughRate;
        videosWithData++;
      }

      if (video.completion.rate > 0) {
        totalCompletionRate += video.completion.rate;
      }

      if (video.watchTime.average > 0) {
        totalWatchTime += video.watchTime.average;
      }

      if (video.retention.averageRetention > 0) {
        totalRetention += video.retention.averageRetention;
      }

      // By type
      const type = video.video.type;
      if (analytics.byType[type]) {
        analytics.byType[type].count++;
        if (!analytics.byType[type].metrics.totalViews) {
          analytics.byType[type].metrics = {
            totalViews: 0,
            averageViewThroughRate: 0,
            averageCompletionRate: 0,
            averageWatchTime: 0
          };
        }
        analytics.byType[type].metrics.totalViews += video.views.total || 0;
      }

      // By platform
      const platform = video.platform;
      if (!analytics.byPlatform[platform]) {
        analytics.byPlatform[platform] = {
          count: 0,
          totalViews: 0,
          averageViewThroughRate: 0,
          averageCompletionRate: 0
        };
      }
      analytics.byPlatform[platform].count++;
      analytics.byPlatform[platform].totalViews += video.views.total || 0;
    });

    // Calculate averages
    if (videosWithData > 0) {
      analytics.averageViewThroughRate = totalViewThroughRate / videosWithData;
      analytics.averageCompletionRate = totalCompletionRate / videos.length;
      analytics.averageWatchTime = totalWatchTime / videos.length;
      analytics.averageRetention = totalRetention / videos.length;
    }

    // Calculate type-specific averages
    Object.keys(analytics.byType).forEach(type => {
      const typeData = analytics.byType[type];
      if (typeData.count > 0) {
        typeData.metrics.averageViewThroughRate = analytics.averageViewThroughRate;
        typeData.metrics.averageCompletionRate = analytics.averageCompletionRate;
        typeData.metrics.averageWatchTime = analytics.averageWatchTime;
      }
    });

    // Top performers
    analytics.topPerformers = videos
      .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0))
      .slice(0, 10)
      .map(video => ({
        postId: video.postId,
        platform: video.platform,
        type: video.video.type,
        views: video.views.total,
        viewThroughRate: video.viewThroughRate,
        completionRate: video.completion.rate,
        watchTime: video.watchTime.average,
        performanceScore: video.performanceScore
      }));

    return analytics;
  } catch (error) {
    logger.error('Error getting video metrics analytics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get retention curve for a video
 */
async function getRetentionCurve(postId) {
  try {
    const videoMetrics = await VideoMetrics.findOne({ postId }).lean();
    if (!videoMetrics) {
      throw new Error('Video metrics not found');
    }

    return {
      curve: videoMetrics.retention.curve || [],
      averageRetention: videoMetrics.retention.averageRetention || 0,
      peakRetention: videoMetrics.retention.peakRetention || 0,
      dropOffPoints: videoMetrics.retention.dropOffPoints || [],
      videoDuration: videoMetrics.video.duration
    };
  } catch (error) {
    logger.error('Error getting retention curve', { error: error.message, postId });
    throw error;
  }
}

module.exports = {
  updateVideoMetrics,
  getVideoMetricsAnalytics,
  getRetentionCurve
};


