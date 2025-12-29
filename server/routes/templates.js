// Content templates routes

const express = require('express');
const ContentTemplate = require('../models/ContentTemplate');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Get templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { category, niche, public: publicOnly } = req.query;

  const query = {
    $or: [
      { isPublic: true },
      { createdBy: req.user._id },
      { isSystemTemplate: true }
    ]
  };

  if (category) {
    query.category = category;
  }

  if (niche) {
    query.niche = niche;
  }

  if (publicOnly === 'true') {
    query.isPublic = true;
  }

  const templates = await ContentTemplate.find(query)
    .sort({ usageCount: -1, rating: -1 })
    .limit(50);

  sendSuccess(res, 'Templates fetched', 200, templates);
}));

/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, description, category, niche, templateData, preview, tags, isPublic } = req.body;

  if (!name || !category || !templateData) {
    return sendError(res, 'Name, category, and templateData are required', 400);
  }

  const template = new ContentTemplate({
    name,
    description: description || '',
    category,
    niche: niche || 'general',
    createdBy: req.user._id,
    isPublic: isPublic || false,
    templateData,
    preview: preview || {},
    tags: tags || []
  });

  await template.save();
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * @swagger
 * /api/templates/{templateId}/use:
 *   post:
 *     summary: Use template (increments usage)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:templateId/use', auth, asyncHandler(async (req, res) => {
  const template = await ContentTemplate.findById(req.params.templateId);

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  template.usageCount += 1;
  await template.save();

  sendSuccess(res, 'Template used', 200, template);
}));

/**
 * @swagger
 * /api/templates/{templateId}:
 *   get:
 *     summary: Get template details
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:templateId', auth, asyncHandler(async (req, res) => {
  const template = await ContentTemplate.findById(req.params.templateId);

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  // Check access
  if (!template.isPublic && !template.isSystemTemplate && template.createdBy.toString() !== req.user._id.toString()) {
    return sendError(res, 'Template not accessible', 403);
  }

  sendSuccess(res, 'Template fetched', 200, template);
}));

/**
 * @swagger
 * /api/templates/{templateId}:
 *   delete:
 *     summary: Delete template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:templateId', auth, asyncHandler(async (req, res) => {
  const template = await ContentTemplate.findById(req.params.templateId);

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  if (template.createdBy.toString() !== req.user._id.toString()) {
    return sendError(res, 'Unauthorized to delete this template', 403);
  }

  await template.deleteOne();
  sendSuccess(res, 'Template deleted', 200);
}));

/**
 * @swagger
 * /api/templates/{templateId}/rate:
 *   post:
 *     summary: Rate and review a template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:templateId/rate', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { rating, review } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'Rating must be between 1 and 5', 400);
  }

  const template = await ContentTemplate.findById(templateId);
  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  // Initialize ratings array if needed
  if (!template.ratings) {
    template.ratings = [];
  }

  // Check if user already rated
  const existingRatingIndex = template.ratings.findIndex(
    r => r.userId.toString() === req.user._id.toString()
  );

  if (existingRatingIndex >= 0) {
    // Update existing rating
    template.ratings[existingRatingIndex].rating = rating;
    template.ratings[existingRatingIndex].review = review || template.ratings[existingRatingIndex].review;
    template.ratings[existingRatingIndex].createdAt = new Date();
  } else {
    // Add new rating
    template.ratings.push({
      userId: req.user._id,
      rating,
      review: review || '',
      createdAt: new Date()
    });
  }

  // Calculate average rating
  const totalRating = template.ratings.reduce((sum, r) => sum + r.rating, 0);
  template.rating = totalRating / template.ratings.length;

  await template.save();
  sendSuccess(res, 'Template rated successfully', 200, template);
}));

/**
 * @swagger
 * /api/templates/marketplace:
 *   get:
 *     summary: Get marketplace templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/marketplace', auth, asyncHandler(async (req, res) => {
  const { category, niche, featured, sortBy = 'popular', limit = 20, skip = 0 } = req.query;

  const query = { isPublic: true };

  if (category) query.category = category;
  if (niche) query.niche = niche;
  if (featured === 'true') query.isFeatured = true;

  let sort = {};
  switch (sortBy) {
    case 'popular':
      sort = { usageCount: -1, rating: -1 };
      break;
    case 'rating':
      sort = { rating: -1, usageCount: -1 };
      break;
    case 'newest':
      sort = { createdAt: -1 };
      break;
    default:
      sort = { usageCount: -1 };
  }

  const templates = await ContentTemplate.find(query)
    .populate('createdBy', 'name email')
    .sort(sort)
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .lean();

  sendSuccess(res, 'Marketplace templates fetched', 200, templates);
}));

module.exports = router;
