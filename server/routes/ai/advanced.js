// Advanced AI Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const advancedAIService = require('../../services/advancedAIService');
const logger = require('../../utils/logger');

/**
 * POST /api/ai/advanced/multi-modal
 * Generate multi-modal content
 */
router.post('/multi-modal', authenticate, async (req, res) => {
  try {
    const { prompt, mediaTypes = ['text', 'image'] } = req.body;

    if (!prompt) {
      return sendError(res, 'Prompt is required', 400);
    }

    const result = await advancedAIService.generateMultiModalContent(prompt, mediaTypes);
    return sendSuccess(res, result);
  } catch (error) {
    logger.error('Error generating multi-modal content', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/ai/advanced/content-series
 * Generate content series
 */
router.post('/content-series', authenticate, async (req, res) => {
  try {
    const { topic, count = 5, options = {} } = req.body;

    if (!topic) {
      return sendError(res, 'Topic is required', 400);
    }

    const series = await advancedAIService.generateContentSeries(topic, count, options);
    return sendSuccess(res, { series, count: series.length });
  } catch (error) {
    logger.error('Error generating content series', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/ai/advanced/long-form
 * Generate long-form content
 */
router.post('/long-form', authenticate, async (req, res) => {
  try {
    const { topic, options = {} } = req.body;

    if (!topic) {
      return sendError(res, 'Topic is required', 400);
    }

    const content = await advancedAIService.generateLongFormContent(topic, options);
    return sendSuccess(res, content);
  } catch (error) {
    logger.error('Error generating long-form content', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/ai/advanced/interactive
 * Generate interactive content
 */
router.post('/interactive', authenticate, async (req, res) => {
  try {
    const { topic, type = 'poll' } = req.body;

    if (!topic) {
      return sendError(res, 'Topic is required', 400);
    }

    const content = await advancedAIService.generateInteractiveContent(topic, type);
    return sendSuccess(res, content);
  } catch (error) {
    logger.error('Error generating interactive content', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/ai/advanced/style-transfer
 * Transfer content style
 */
router.post('/style-transfer', authenticate, async (req, res) => {
  try {
    const { sourceContent, targetStyle } = req.body;

    if (!sourceContent || !targetStyle) {
      return sendError(res, 'Source content and target style are required', 400);
    }

    const transformed = await advancedAIService.transferContentStyle(sourceContent, targetStyle);
    return sendSuccess(res, { transformedContent: transformed });
  } catch (error) {
    logger.error('Error transferring content style', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/ai/advanced/recommendations
 * Generate content recommendations
 */
router.post('/recommendations', authenticate, async (req, res) => {
  try {
    const { performanceData } = req.body;
    const userId = req.user.id;

    if (!performanceData) {
      return sendError(res, 'Performance data is required', 400);
    }

    const recommendations = await advancedAIService.generateContentRecommendations(
      userId,
      performanceData
    );
    return sendSuccess(res, { recommendations });
  } catch (error) {
    logger.error('Error generating recommendations', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
