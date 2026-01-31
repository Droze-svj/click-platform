// Content templates routes

const express = require('express');
const ContentTemplate = require('../models/ContentTemplate');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
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
  try {
    const userId = req.user?._id || req.user?.id;
    
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                        (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
    
    // Check if MongoDB is connected before attempting queries
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      if (allowDevMode) {
        logger.warn('MongoDB not connected, returning empty array for templates');
        return sendSuccess(res, 'Templates fetched', 200, []);
      }
      return sendError(res, 'Database connection unavailable', 503);
    }
    
    // In development mode OR when on localhost, return only public/system templates for dev users
    if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
      // Return only public and system templates for dev users
      const query = {
        $or: [
          { isPublic: true },
          { isSystemTemplate: true }
        ]
      };
      
      const { category, niche, limit, sortBy, sortOrder } = req.query;
      if (category) query.category = category;
      if (niche) query.niche = niche;
      
      let sort = { usageCount: -1, rating: -1 };
      if (sortBy === 'usageCount') {
        sort = { usageCount: sortOrder === 'asc' ? 1 : -1 };
      } else if (sortBy === 'rating') {
        sort = { rating: sortOrder === 'asc' ? 1 : -1 };
      }
      
      try {
        // Add timeout to prevent buffering timeout errors
        const templates = await ContentTemplate.find(query)
          .sort(sort)
          .limit(parseInt(limit) || 50)
          .maxTimeMS(5000) // 5 second timeout (well below 10s buffering limit)
          .lean();
        return sendSuccess(res, 'Templates fetched', 200, templates || []);
      } catch (dbError) {
        // Handle timeout specifically
        if (dbError.message && dbError.message.includes('buffering timed out')) {
          logger.warn('Template query timeout for dev user, returning empty array', { error: dbError.message });
        } else {
          logger.warn('Error fetching templates for dev user, returning empty array', { error: dbError.message });
        }
        return sendSuccess(res, 'Templates fetched', 200, []);
      }
    }

    const { category, niche, public: publicOnly, limit, sortBy, sortOrder } = req.query;

    const query = {
      $or: [
        { isPublic: true },
        { createdBy: userId },
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

    let sort = { usageCount: -1, rating: -1 };
    if (sortBy === 'usageCount') {
      sort = { usageCount: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'rating') {
      sort = { rating: sortOrder === 'asc' ? 1 : -1 };
    }

    let templates = [];
    try {
      templates = await ContentTemplate.find(query)
        .sort(sort)
        .limit(parseInt(limit) || 50)
        .maxTimeMS(5000) // 5 second timeout to prevent buffering timeout
        .lean();
    } catch (dbError) {
      // Handle timeout specifically
      if (dbError.message && (dbError.message.includes('buffering timed out') || dbError.message.includes('timed out'))) {
        logger.warn('Templates query timeout, returning empty array', { error: dbError.message, userId });
        templates = [];
      }
      // Handle CastError gracefully for dev mode
      else if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId'))) {
        logger.warn('CastError in templates query, returning only public templates for dev mode', { error: dbError.message, userId });
        // Try to get only public templates
        try {
          const publicQuery = { isPublic: true };
          if (category) publicQuery.category = category;
          if (niche) publicQuery.niche = niche;
          templates = await ContentTemplate.find(publicQuery)
            .sort(sort)
            .limit(parseInt(limit) || 50)
            .maxTimeMS(5000)
            .lean();
        } catch (e) {
          logger.warn('Error fetching public templates, returning empty array', { error: e.message });
          templates = [];
        }
      } else {
        logger.warn('Error fetching templates from database', { error: dbError.message, userId });
        templates = [];
      }
    }

    sendSuccess(res, 'Templates fetched', 200, templates || []);
  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    logger.error('Error fetching templates', { error: error.message, stack: error.stack, userId });
    sendSuccess(res, 'Templates fetched', 200, []);
  }
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
  // Check if MongoDB is connected before attempting queries
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return sendError(res, 'Database connection unavailable', 503);
  }

  const template = await ContentTemplate.findById(req.params.templateId)
    .maxTimeMS(8000);

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
  // Check if MongoDB is connected before attempting queries
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return sendError(res, 'Database connection unavailable', 503);
  }

  const template = await ContentTemplate.findById(req.params.templateId)
    .maxTimeMS(8000);

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
  // Check if MongoDB is connected before attempting queries
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return sendError(res, 'Database connection unavailable', 503);
  }

  const template = await ContentTemplate.findById(req.params.templateId)
    .maxTimeMS(8000);

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
  // Check if MongoDB is connected before attempting queries
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return sendError(res, 'Database connection unavailable', 503);
  }

  const { templateId } = req.params;
  const { rating, review } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'Rating must be between 1 and 5', 400);
  }

  const template = await ContentTemplate.findById(templateId)
    .maxTimeMS(8000);
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
  try {
    // Check if MongoDB is connected before attempting queries
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, returning empty array for marketplace templates');
      return sendSuccess(res, 'Marketplace templates fetched', 200, []);
    }

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

    let templates = [];
    try {
      templates = await ContentTemplate.find(query)
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .maxTimeMS(5000) // 5 second timeout to prevent buffering timeout
        .lean();
    } catch (dbError) {
      // Handle timeout specifically
      if (dbError.message && (dbError.message.includes('buffering timed out') || dbError.message.includes('timed out'))) {
        logger.warn('Marketplace templates query timeout, returning empty array', { error: dbError.message });
      } else {
        logger.warn('Error fetching marketplace templates from database', { error: dbError.message });
      }
      // Return empty array if database query fails
      templates = [];
    }

    sendSuccess(res, 'Marketplace templates fetched', 200, templates);
  } catch (error) {
    logger.error('Error fetching marketplace templates', { error: error.message, stack: error.stack });
    sendSuccess(res, 'Marketplace templates fetched', 200, []);
  }
}));

module.exports = router;
