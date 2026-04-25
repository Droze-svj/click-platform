// Content collaboration features

const express = require('express');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/collaboration/share/{contentId}:
 *   post:
 *     summary: Share content with other users
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/share/:contentId', auth, async (req, res) => {
  try {
    const { userIds, permission = 'view' } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds must be a non-empty array'
      });
    }

    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    // Initialize sharedWith if not exists
    if (!content.sharedWith) {
      content.sharedWith = [];
    }

    // Add shared users
    userIds.forEach(userId => {
      const exists = content.sharedWith.find(s => s.userId.toString() === userId);
      if (!exists) {
        content.sharedWith.push({
          userId,
          permission,
          sharedAt: new Date(),
          sharedBy: req.user._id
        });
      }
    });

    await content.save();

    logger.info('Content shared', {
      contentId: req.params.contentId,
      sharedWith: userIds.length
    });

    res.json({
      success: true,
      message: 'Content shared successfully',
      data: content.sharedWith
    });
  } catch (error) {
    logger.error('Share content error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/collaboration/shared:
 *   get:
 *     summary: Get content shared with user
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.get('/shared', auth, async (req, res) => {
  try {
    const contents = await Content.find({
      'sharedWith.userId': req.user._id
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: contents
    });
  } catch (error) {
    logger.error('Get shared content error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;







