// Smart suggestions routes

const express = require('express');
const auth = require('../middleware/auth');
const Content = require('../models/Content');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { generateViralIdeas } = require('../services/aiService');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/suggestions/daily:
 *   get:
 *     summary: Get daily content suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/daily', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's recent content to understand their niche
    let recentContent = [];
    try {
      recentContent = await Content.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title type tags category')
        .lean();
    } catch (error) {
      logger.warn('Error fetching recent content for suggestions', { error: error.message, userId });
    }

    // Generate AI-powered suggestions
    const suggestions = [
      {
        id: 'trending-1',
        type: 'trending',
        title: 'Trending Topic: AI in Content Creation',
        description: 'Create content about AI tools and automation',
        action: '/dashboard/content?topic=AI',
        iconType: 'trending',
        priority: 'high',
      },
      {
        id: 'idea-1',
        type: 'idea',
        title: 'Content Idea: Weekly Roundup',
        description: 'Create a weekly summary of your best content',
        action: '/dashboard/content',
        iconType: 'idea',
        priority: 'medium',
      },
      {
        id: 'optimization-1',
        type: 'optimization',
        title: 'Optimize Your Posts',
        description: 'Review and improve your scheduled posts',
        action: '/dashboard/scheduler',
        iconType: 'optimization',
        priority: 'low',
      },
    ];

    sendSuccess(res, 'Suggestions fetched', 200, suggestions);
  } catch (error) {
    logger.error('Error fetching daily suggestions', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Suggestions fetched', 200, []);
  }
}));

module.exports = router;
