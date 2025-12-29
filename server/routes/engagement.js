// Engagement routes (challenges, suggestions, etc.)

const express = require('express');
const auth = require('../middleware/auth');
const Content = require('../models/Content');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
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
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get user's content stats for today
  const todayContent = await Content.countDocuments({
    userId,
    createdAt: { $gte: today },
  });

  const totalContent = await Content.countDocuments({ userId });
  const videos = await Content.countDocuments({ userId, type: 'video' });

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
}));

module.exports = router;
