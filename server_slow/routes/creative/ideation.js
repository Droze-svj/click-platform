// AI Ideation Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  generateContentIdeas,
  analyzeTrends,
  brainstormVariations,
  getPerformanceBasedSuggestions,
} = require('../../services/aiIdeationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/creative/ideation/ideas:
 *   post:
 *     summary: Generate content ideas
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ideas', auth, asyncHandler(async (req, res) => {
  const { topic, platform, count, style, audience } = req.body;

  try {
    const ideas = await generateContentIdeas(req.user._id, {
      topic,
      platform: platform || 'general',
      count: count || 10,
      style: style || 'engaging',
      audience: audience || 'general',
    });
    sendSuccess(res, 'Content ideas generated', 200, ideas);
  } catch (error) {
    logger.error('Generate content ideas error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/ideation/trends:
 *   get:
 *     summary: Analyze trends
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trends', auth, asyncHandler(async (req, res) => {
  const { platform, category } = req.query;

  try {
    const trends = await analyzeTrends(platform || 'general', category);
    sendSuccess(res, 'Trends analyzed', 200, trends);
  } catch (error) {
    logger.error('Analyze trends error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/ideation/variations/:contentId:
 *   post:
 *     summary: Brainstorm content variations
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/variations/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const variations = await brainstormVariations(contentId, req.user._id);
    sendSuccess(res, 'Content variations generated', 200, variations);
  } catch (error) {
    logger.error('Brainstorm variations error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/ideation/suggestions:
 *   get:
 *     summary: Get performance-based suggestions
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await getPerformanceBasedSuggestions(req.user._id, limit);
    sendSuccess(res, 'Suggestions generated', 200, result);
  } catch (error) {
    logger.error('Get performance suggestions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// Import template routes
const {
  generateFromTemplate,
  analyzeCompetitorContent,
  getSeasonalTrends,
} = require('../../services/contentTemplateService');

/**
 * @swagger
 * /api/creative/ideation/template:
 *   post:
 *     summary: Generate content from template
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/template', auth, asyncHandler(async (req, res) => {
  const { templateType, variables } = req.body;

  if (!templateType) {
    return sendError(res, 'Template type is required', 400);
  }

  try {
    const content = await generateFromTemplate(templateType, variables || {});
    sendSuccess(res, 'Content generated from template', 200, content);
  } catch (error) {
    logger.error('Generate from template error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/ideation/competitor:
 *   post:
 *     summary: Analyze competitor content
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/competitor', auth, asyncHandler(async (req, res) => {
  const { competitorUrls, platform } = req.body;

  if (!competitorUrls || !Array.isArray(competitorUrls)) {
    return sendError(res, 'Competitor URLs array is required', 400);
  }

  try {
    const analysis = await analyzeCompetitorContent(competitorUrls, platform || 'general');
    sendSuccess(res, 'Competitor content analyzed', 200, analysis);
  } catch (error) {
    logger.error('Analyze competitor content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/ideation/seasonal:
 *   get:
 *     summary: Get seasonal trends
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/seasonal', auth, asyncHandler(async (req, res) => {
  const { season, category } = req.query;

  try {
    const trends = await getSeasonalTrends(season, category);
    sendSuccess(res, 'Seasonal trends fetched', 200, trends);
  } catch (error) {
    logger.error('Get seasonal trends error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

