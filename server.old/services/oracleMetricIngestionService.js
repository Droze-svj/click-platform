const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const logger = require('../utils/logger');

/**
 * Task 9.1: Oracle Metric Ingestion
 * Periodically ingests actual performance data from social platforms.
 */

async function ingestPostMetrics(workspaceId) {
  try {
    logger.info('Starting Oracle Metric Ingestion', { workspaceId });

    // 1. Get posts from the last 7 days that are 'posted'
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activePosts = await ScheduledPost.find({
      workspaceId,
      status: 'posted',
      postedAt: { $gte: sevenDaysAgo }
    }).lean();

    if (activePosts.length === 0) {
      logger.info('No active posts to ingest for workspace', { workspaceId });
      return { ingested: 0 };
    }

    // 2. Fetch real metrics from platforms (Mocked for now)
    const results = [];
    for (const post of activePosts) {
      const mockMetrics = generateMockMetrics(post);

      const performanceData = await ContentPerformance.findOneAndUpdate(
        { postId: post._id },
        {
          postId: post._id,
          workspaceId: post.workspaceId,
          platform: post.platform,
          performance: {
            engagement: mockMetrics.likes + mockMetrics.comments + mockMetrics.shares,
            clicks: mockMetrics.clicks,
            revenue: mockMetrics.revenue,
            impressions: mockMetrics.views,
            reach: Math.floor(mockMetrics.views * 0.8)
          },
          scores: {
            engagement: calculateScore(mockMetrics.likes + mockMetrics.comments, mockMetrics.views),
            clickThrough: calculateScore(mockMetrics.clicks, mockMetrics.views),
            overall: calculateOverallScore(mockMetrics)
          },
          postedAt: post.postedAt,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      results.push(performanceData);
    }

    logger.info('Oracle Metric Ingestion complete', { workspaceId, count: results.length });
    return { ingested: results.length, data: results };
  } catch (error) {
    logger.error('Oracle Metric Ingestion failed', { error: error.message, workspaceId });
    throw error;
  }
}

function generateMockMetrics(post) {
  const baseViews = post.platform === 'tiktok' ? 1200 : 450;
  const multiplier = Math.random() * 5 + 1;
  const views = Math.floor(baseViews * multiplier);
  const likes = Math.floor(views * 0.08);
  const comments = Math.floor(likes * 0.1);
  const shares = Math.floor(likes * 0.05);
  const clicks = Math.floor(views * 0.02);
  const revenue = clicks * 2.5;

  return { views, likes, comments, shares, clicks, revenue };
}

function calculateScore(metric, views) {
  if (!views) return 0;
  return Math.min(100, Math.floor((metric / views) * 1000));
}

function calculateOverallScore(m) {
  const engagementRate = (m.likes + m.comments) / m.views;
  const conversionRate = m.clicks / m.views;
  return Math.min(100, Math.floor((engagementRate * 400) + (conversionRate * 600)));
}

module.exports = {
  ingestPostMetrics
};
