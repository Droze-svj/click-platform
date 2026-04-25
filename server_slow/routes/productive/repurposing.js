// Content Repurposing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  repurposeContent,
  batchRepurposeContent,
  createContentVariations,
  extractKeyPoints,
} = require('../../services/contentRepurposingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/productive/repurposing/:contentId:
 *   post:
 *     summary: Repurpose content for platform
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { targetPlatform } = req.body;

  if (!targetPlatform) {
    return sendError(res, 'Target platform is required', 400);
  }

  try {
    const repurposed = await repurposeContent(contentId, req.user._id, targetPlatform);
    sendSuccess(res, 'Content repurposed', 200, repurposed);
  } catch (error) {
    logger.error('Repurpose content error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/repurposing/:contentId/batch:
 *   post:
 *     summary: Batch repurpose for multiple platforms
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/batch', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platforms } = req.body;

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return sendError(res, 'Platforms array is required', 400);
  }

  try {
    const results = await batchRepurposeContent(contentId, req.user._id, platforms);
    sendSuccess(res, 'Content batch repurposed', 200, results);
  } catch (error) {
    logger.error('Batch repurpose content error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/repurposing/:contentId/variations:
 *   post:
 *     summary: Create content variations
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/variations', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { count } = req.body;

  try {
    const variations = await createContentVariations(contentId, req.user._id, count || 3);
    sendSuccess(res, 'Content variations created', 200, variations);
  } catch (error) {
    logger.error('Create content variations error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/repurposing/:contentId/key-points:
 *   get:
 *     summary: Extract key points
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/key-points', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const keyPoints = await extractKeyPoints(contentId, req.user._id);
    sendSuccess(res, 'Key points extracted', 200, keyPoints);
  } catch (error) {
    logger.error('Extract key points error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

// Import advanced repurposing routes
const {
  autoFormatContent,
  adaptVisualContent,
  optimizeForSEO,
} = require('../../services/advancedRepurposingService');

/**
 * @swagger
 * /api/productive/repurposing/auto-format:
 *   post:
 *     summary: Auto-format content
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/auto-format', auth, asyncHandler(async (req, res) => {
  const { contentText, platform, includeEmojis, includeHashtags, lineBreaks, maxLength } = req.body;

  if (!contentText || !platform) {
    return sendError(res, 'Content text and platform are required', 400);
  }

  try {
    const formatted = await autoFormatContent(contentText, platform, {
      includeEmojis: includeEmojis !== false,
      includeHashtags: includeHashtags !== false,
      lineBreaks: lineBreaks !== false,
      maxLength,
    });
    sendSuccess(res, 'Content auto-formatted', 200, formatted);
  } catch (error) {
    logger.error('Auto-format content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/repurposing/:contentId/visual:
 *   post:
 *     summary: Adapt visual content
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/visual', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { targetPlatform } = req.body;

  if (!targetPlatform) {
    return sendError(res, 'Target platform is required', 400);
  }

  try {
    const adapted = await adaptVisualContent(contentId, req.user._id, targetPlatform);
    sendSuccess(res, 'Visual content adapted', 200, adapted);
  } catch (error) {
    logger.error('Adapt visual content error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/repurposing/seo:
 *   post:
 *     summary: Optimize for SEO
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/seo', auth, asyncHandler(async (req, res) => {
  const { contentText, keywords } = req.body;

  if (!contentText) {
    return sendError(res, 'Content text is required', 400);
  }

  try {
    const optimized = await optimizeForSEO(contentText, keywords || []);
    sendSuccess(res, 'Content optimized for SEO', 200, optimized);
  } catch (error) {
    logger.error('Optimize for SEO error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

