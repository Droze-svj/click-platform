// Engagement routes (challenges, suggestions, etc.)

const express = require('express');
const auth = require('../middleware/auth');
const Content = require('../models/Content');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { clampInt } = require('../utils/pagination');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/engagement/challenges:
 *   get:
 *     summary: Get daily challenges
 *     tags: [Engagement]
 *     security:
 *       - bearerAuth: []
 */
router.get('/challenges', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return sendSuccess(res, 'Challenges fetched', 200, []);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Content.userId is a String, so dev/Supabase ids query cleanly — compute
    // real challenge progress for every user (no dev-mode short-circuit).
    let todayContent = 0;
    let videos = 0;
    try {
      todayContent = await Content.countDocuments({ userId, createdAt: { $gte: today } });
      videos = await Content.countDocuments({ userId, type: 'video' });
    } catch (dbError) {
      logger.warn('Error counting content for challenges', { error: dbError.message, userId });
    }

    // Generate challenges based on user activity
    const challenges = [
      {
        id: 'content-1',
        title: 'Create 3 Posts Today',
        description: 'Generate 3 new social media posts',
        type: 'content',
        target: 3,
        current: todayContent,
        reward: '50 XP',
        completed: todayContent >= 3,
        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'video-1',
        title: 'Upload Your First Video',
        description: 'Upload and process a video',
        type: 'video',
        target: 1,
        current: videos > 0 ? 1 : 0,
        reward: '100 XP',
        completed: videos > 0,
        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'engagement-1',
        title: 'Check Your Analytics',
        description: 'View your content performance',
        type: 'engagement',
        target: 1,
        current: 0, // Would need to track if user viewed analytics
        reward: '25 XP',
        completed: false,
        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    sendSuccess(res, 'Challenges fetched', 200, challenges);
  } catch (error) {
    logger.error('Error fetching challenges', { error: error.message, userId: req.user?._id || req.user?.id });
    sendSuccess(res, 'Challenges fetched', 200, []);
  }
}));

/**
 * @swagger
 * /api/engagement/activities:
 *   get:
 *     summary: Get user activity feed
 *     tags: [Engagement]
 *     security:
 *       - bearerAuth: []
 */
router.get('/activities', auth, asyncHandler(async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return sendSuccess(res, 'Activities fetched', 200, { activities: [] });
    }

    // Real activity feed for every user. Activity.userId may be an ObjectId;
    // a non-castable id (Supabase UUID) just yields an empty list via catch.
    const Activity = require('../models/Activity');

    let activities = [];
    try {
      activities = await Activity.find({ userId })
        .sort({ createdAt: -1 })
        .limit(clampInt(limit, 20, 500))
        .lean();
    } catch (dbError) {
      logger.warn('Error fetching activities from database', { error: dbError.message, userId });
      activities = [];
    }

    sendSuccess(res, 'Activities fetched', 200, { activities: activities || [] });
  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    logger.error('Error fetching activities', { error: error.message, stack: error.stack, userId });
    sendSuccess(res, 'Activities fetched', 200, { activities: [] });
  }
}));

module.exports = router;
