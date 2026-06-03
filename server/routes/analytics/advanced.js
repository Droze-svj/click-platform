// Advanced analytics routes

const express = require('express');
const Content = require('../../models/Content');
const ScheduledPost = require('../../models/ScheduledPost');
const User = require('../../models/User');
const auth = require('../../middleware/auth');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/advanced/insights:
 *   get:
 *     summary: Get advanced insights
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/insights', auth, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period, 10));

    // Get user's content
    const contents = await Content.find({
      userId: req.user._id,
      createdAt: { $gte: startDate }
    });

    // Calculate insights
    const insights = {
      totalContent: contents.length,
      byType: {},
      byStatus: {},
      averageProcessingTime: 0,
      successRate: 0,
      topPerforming: [],
      engagementTrend: [],
      bestTimeToPost: {},
      contentVelocity: 0
    };

    // Group by type
    contents.forEach(content => {
      insights.byType[content.type] = (insights.byType[content.type] || 0) + 1;
      insights.byStatus[content.status] = (insights.byStatus[content.status] || 0) + 1;
    });

    // Calculate success rate
    const completed = contents.filter(c => c.status === 'completed').length;
    insights.successRate = contents.length > 0 ? (completed / contents.length) * 100 : 0;

    // Top performing content
    const topContent = contents
      .filter(c => c.analytics?.engagement)
      .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))
      .slice(0, 5);

    insights.topPerforming = topContent.map(c => ({
      id: c._id,
      title: c.title,
      engagement: c.analytics?.engagement || 0,
      views: c.analytics?.views || 0
    }));

    // Content velocity (content per day)
    const days = parseInt(period, 10);
    insights.contentVelocity = days > 0 ? contents.length / days : 0;

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Advanced insights error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/analytics/advanced/predictions:
 *   get:
 *     summary: Get AI-powered predictions
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/predictions', auth, async (req, res) => {
  try {
    // Get user's content history
    const contents = await Content.find({
      userId: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(50);

    const engagementOf = (c) => (c.analytics && typeof c.analytics.engagement === 'number')
      ? c.analytics.engagement
      : null;

    // Recommended content type = the type that has earned the highest average
    // engagement (falls back to most frequent type). Null when there's no data.
    let recommendedContentType = null;
    if (contents.length > 0) {
      const typeStats = {};
      for (const c of contents) {
        if (!c.type) continue;
        const eng = engagementOf(c);
        if (!typeStats[c.type]) typeStats[c.type] = { engSum: 0, engCount: 0, count: 0 };
        typeStats[c.type].count += 1;
        if (eng !== null) { typeStats[c.type].engSum += eng; typeStats[c.type].engCount += 1; }
      }
      let best = null;
      let bestKey = -1;
      for (const [type, s] of Object.entries(typeStats)) {
        // Prefer avg engagement; if no engagement data, rank by frequency.
        const key = s.engCount > 0 ? s.engSum / s.engCount : s.count / 1000;
        if (key > bestKey) { bestKey = key; best = type; }
      }
      recommendedContentType = best;
    }

    // Best posting hour from real createdAt timestamps weighted by engagement.
    const hourBuckets = {};
    for (const c of contents) {
      if (!c.createdAt) continue;
      const eng = engagementOf(c);
      const hour = new Date(c.createdAt).getHours();
      if (Number.isNaN(hour)) continue;
      if (!hourBuckets[hour]) hourBuckets[hour] = { eng: 0, count: 0 };
      hourBuckets[hour].eng += (eng || 0);
      hourBuckets[hour].count += 1;
    }
    let bestPostingTime = null;
    let bestScore = -1;
    for (const [h, b] of Object.entries(hourBuckets)) {
      const score = b.count > 0 ? b.eng / b.count : 0;
      if (score > bestScore) { bestScore = score; bestPostingTime = parseInt(h, 10); }
    }
    if (bestPostingTime !== null) {
      const period = bestPostingTime >= 12 ? 'PM' : 'AM';
      const display = bestPostingTime % 12 === 0 ? 12 : bestPostingTime % 12;
      bestPostingTime = `${display}:00 ${period}`;
    }

    // Estimated engagement band from real average engagement (null if unknown).
    const engValues = contents.map(engagementOf).filter(v => v !== null);
    let estimatedEngagement = null;
    if (engValues.length > 0) {
      const avg = engValues.reduce((s, v) => s + v, 0) / engValues.length;
      estimatedEngagement = avg >= 1000 ? 'High' : avg >= 100 ? 'Medium' : 'Low';
    }

    // Growth projection from the real trend between the older and newer halves
    // of the user's recent content. Null when there isn't enough history.
    let growthProjection = null;
    if (engValues.length >= 6) {
      const half = Math.floor(contents.length / 2);
      const recent = contents.slice(0, half).map(engagementOf).filter(v => v !== null);
      const older = contents.slice(half).map(engagementOf).filter(v => v !== null);
      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
        const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
        if (olderAvg > 0) {
          const ratePer30 = ((recentAvg - olderAvg) / olderAvg) * 100;
          growthProjection = {
            next30Days: `${ratePer30 >= 0 ? '+' : ''}${ratePer30.toFixed(1)}%`,
            next90Days: `${ratePer30 >= 0 ? '+' : ''}${(ratePer30 * 3).toFixed(1)}%`
          };
        }
      }
    }

    const predictions = {
      bestPostingTime,
      recommendedContentType,
      estimatedEngagement,
      // General best-practice tips (not user-specific metrics).
      suggestedTopics: [
        'Continue creating content similar to your top performers',
        'Try experimenting with different formats',
        'Post more consistently for better reach'
      ],
      growthProjection
    };

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    logger.error('Predictions error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;







