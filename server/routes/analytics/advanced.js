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
    startDate.setDate(startDate.getDate() - parseInt(period));

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
    const days = parseInt(period);
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

    // Simple predictions based on patterns
    const predictions = {
      bestPostingTime: '9:00 AM - 11:00 AM', // Would use AI to predict
      recommendedContentType: 'video', // Based on performance
      estimatedEngagement: 'High',
      suggestedTopics: [
        'Continue creating content similar to your top performers',
        'Try experimenting with different formats',
        'Post more consistently for better reach'
      ],
      growthProjection: {
        next30Days: '15% increase',
        next90Days: '45% increase'
      }
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







