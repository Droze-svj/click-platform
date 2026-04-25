// Predictive Analytics Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const predictionService = require('../../services/predictionService');
const Content = require('../../models/Content');
const logger = require('../../utils/logger');

/**
 * POST /api/analytics/predictions/content
 * Predict content performance
 */
router.post('/content', authenticate, async (req, res) => {
  try {
    const { contentId } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    // Get content
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    // Predict performance
    const predictions = await predictionService.predictContentPerformance(contentId, {
      userId,
      type: content.type,
      category: content.category,
      title: content.title,
      description: content.description,
      tags: content.tags,
    });

    return sendSuccess(res, predictions);
  } catch (error) {
    logger.error('Error predicting content performance', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/analytics/predictions/audience-growth
 * Predict audience growth
 */
router.get('/audience-growth', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;

    // Predict audience growth
    const predictions = await predictionService.predictAudienceGrowth(
      userId,
      parseInt(days)
    );

    return sendSuccess(res, predictions);
  } catch (error) {
    logger.error('Error predicting audience growth', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
