// Content moderation routes

const express = require('express');
const auth = require('../middleware/auth');
const { moderateContent, flagForReview } = require('../services/contentModerationService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/moderation/check:
 *   post:
 *     summary: Moderate content
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 */
router.post('/check', auth, asyncHandler(async (req, res) => {
  const { text, title, description, options } = req.body;

  if (!text && !title && !description) {
    return sendError(res, 'Content text, title, or description is required', 400);
  }

  try {
    const result = await moderateContent(null, {
      text,
      title,
      description,
      ...options,
    });

    sendSuccess(res, 'Content moderation complete', 200, result);
  } catch (error) {
    logger.error('Content moderation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/moderation/flag/:contentId:
 *   post:
 *     summary: Flag content for manual review
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 */
router.post('/flag/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  try {
    const result = await flagForReview(contentId, reason, userId);
    sendSuccess(res, 'Content flagged for review', 200, result);
  } catch (error) {
    logger.error('Flag content error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






