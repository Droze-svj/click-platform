/**
 * Video Sharing & Social Integration Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const socialMediaService = require('../services/socialMediaService');
const Content = require('../models/Content');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/social/share:
 *   post:
 *     summary: Share content to multiple social platforms
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/share', auth, async (req, res) => {
  const { contentId, platforms, title, description, tags } = req.body;
  const userId = req.user.id;

  if (!contentId || !platforms || !Array.isArray(platforms)) {
    return sendError(res, 'contentId and platforms array are required', 400);
  }

  try {
    const content = await Content.findById(contentId);
    if (!content) return sendError(res, 'Content not found', 404);

    const mediaUrl = content.originalFile.url; // Or the viral edited version
    
    logger.info('Starting bulk social share', { userId, contentId, platforms });

    const results = await Promise.all(platforms.map(platform => 
      socialMediaService.postToSocial(userId, platform, {
        title: title || content.title,
        description: description || content.description,
        mediaUrl,
        tags
      })
    ));

    const allSuccessful = results.every(r => r.success);
    
    // Update content metadata with share history
    content.metadata = content.metadata || {};
    content.metadata.shareHistory = content.metadata.shareHistory || [];
    content.metadata.shareHistory.push({
      batchId: Date.now(),
      platforms: platforms,
      timestamp: new Date(),
      results
    });
    
    await content.save();

    sendSuccess(res, { results }, allSuccessful ? 'Successfully shared to all platforms' : 'Shared with some errors');

  } catch (error) {
    logger.error('Social share route error', { error: error.message });
    sendError(res, error.message, 500);
  }
});

/**
 * @swagger
 * /api/social/accounts:
 *   get:
 *     summary: List connected social accounts
 *     tags: [Social]
 */
router.get('/accounts', auth, async (req, res) => {
  try {
    // Placeholder logic - should fetch from User model or separate Connection model
    const accounts = [
      { platform: 'tiktok', connected: true, username: '@user_dev' },
      { platform: 'youtube', connected: false },
      { platform: 'instagram', connected: true, username: 'user_dev_ig' }
    ];
    
    sendSuccess(res, accounts);
  } catch (error) {
    sendError(res, error.message, 500);
  }
});

module.exports = router;
