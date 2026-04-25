// Content Marketplace Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const contentMarketplaceService = require('../../services/contentMarketplaceService');
const logger = require('../../utils/logger');

/**
 * GET /api/marketplace
 * Get marketplace items
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      category: req.query.category,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      search: req.query.search,
      sortBy: req.query.sortBy || 'popular',
    };

    const items = contentMarketplaceService.getMarketplaceItems(filters);
    return sendSuccess(res, { items, count: items.length });
  } catch (error) {
    logger.error('Error getting marketplace items', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/marketplace
 * Create marketplace item
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const itemData = { ...req.body, userId };

    const item = await contentMarketplaceService.createMarketplaceItem(itemData);
    return sendSuccess(res, item, 'Marketplace item created');
  } catch (error) {
    logger.error('Error creating marketplace item', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/marketplace/:itemId/purchase
 * Purchase marketplace item
 */
router.post('/:itemId/purchase', authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const result = await contentMarketplaceService.purchaseItem(userId, itemId);
    return sendSuccess(res, result, 'Item purchased successfully');
  } catch (error) {
    logger.error('Error purchasing item', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/marketplace/:itemId/rate
 * Rate marketplace item
 */
router.post('/:itemId/rate', authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    if (!rating) {
      return sendError(res, 'Rating is required', 400);
    }

    const result = await contentMarketplaceService.rateItem(userId, itemId, rating, review);
    return sendSuccess(res, result, 'Item rated successfully');
  } catch (error) {
    logger.error('Error rating item', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/marketplace/my-items
 * Get user's marketplace items
 */
router.get('/my-items', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = contentMarketplaceService.getUserMarketplaceItems(userId);
    return sendSuccess(res, { items, count: items.length });
  } catch (error) {
    logger.error('Error getting user marketplace items', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
