// Template Marketplace Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getMarketplaceTemplates,
  publishToMarketplace,
  unpublishFromMarketplace,
  rateTemplate,
  getTemplateStats,
  getFeaturedTemplates,
  getTrendingTemplates,
} = require('../../services/templateMarketplaceService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/templates/marketplace:
 *   get:
 *     summary: Get marketplace templates
 *     tags: [Templates]
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    category,
    niche,
    search,
    sortBy = 'popularity',
    limit = 20,
    skip = 0,
  } = req.query;

  try {
    const result = await getMarketplaceTemplates({
      category,
      niche,
      search,
      sortBy,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    sendSuccess(res, 'Marketplace templates fetched', 200, result);
  } catch (error) {
    logger.error('Get marketplace templates error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/featured:
 *   get:
 *     summary: Get featured templates
 *     tags: [Templates]
 */
router.get('/featured', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const templates = await getFeaturedTemplates(limit);
    sendSuccess(res, 'Featured templates fetched', 200, templates);
  } catch (error) {
    logger.error('Get featured templates error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/trending:
 *   get:
 *     summary: Get trending templates
 *     tags: [Templates]
 */
router.get('/trending', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const templates = await getTrendingTemplates(limit);
    sendSuccess(res, 'Trending templates fetched', 200, templates);
  } catch (error) {
    logger.error('Get trending templates error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/:id/publish:
 *   post:
 *     summary: Publish template to marketplace
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/publish', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const template = await publishToMarketplace(id, req.user._id);
    sendSuccess(res, 'Template published', 200, template);
  } catch (error) {
    logger.error('Publish template error', { error: error.message, templateId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/:id/unpublish:
 *   post:
 *     summary: Unpublish template from marketplace
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/unpublish', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const template = await unpublishFromMarketplace(id, req.user._id);
    sendSuccess(res, 'Template unpublished', 200, template);
  } catch (error) {
    logger.error('Unpublish template error', { error: error.message, templateId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/:id/rate:
 *   post:
 *     summary: Rate a template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/rate', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'Rating must be between 1 and 5', 400);
  }

  try {
    const template = await rateTemplate(id, req.user._id, rating);
    sendSuccess(res, 'Template rated', 200, template);
  } catch (error) {
    logger.error('Rate template error', { error: error.message, templateId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/templates/marketplace/:id/stats:
 *   get:
 *     summary: Get template statistics
 *     tags: [Templates]
 */
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const stats = await getTemplateStats(id);
    sendSuccess(res, 'Template stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get template stats error', { error: error.message, templateId: id });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






