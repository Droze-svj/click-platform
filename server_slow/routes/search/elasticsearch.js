// Elasticsearch Search Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  search,
  getSuggestions,
  isEnabled,
} = require('../../services/elasticsearchService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/search/elasticsearch:
 *   post:
 *     summary: Elasticsearch-powered search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  if (!isEnabled()) {
    return sendError(res, 'Elasticsearch is not enabled', 503);
  }

  const { query, index = 'content', filters = {}, sort = [], from = 0, size = 20 } = req.body;

  try {
    const results = await search(index, query, {
      userId: req.user._id.toString(),
      filters,
      sort,
      from,
      size,
    });

    if (!results) {
      return sendError(res, 'Search failed', 500);
    }

    sendSuccess(res, 'Search completed', 200, {
      ...results,
      searchEngine: 'elasticsearch',
    });
  } catch (error) {
    logger.error('Elasticsearch search error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/search/elasticsearch/suggestions:
 *   get:
 *     summary: Get search suggestions (autocomplete)
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  if (!isEnabled()) {
    return sendError(res, 'Elasticsearch is not enabled', 503);
  }

  const { q, index = 'content', size = 5 } = req.query;

  if (!q) {
    return sendError(res, 'Query parameter "q" is required', 400);
  }

  try {
    const suggestions = await getSuggestions(index, q, parseInt(size));
    sendSuccess(res, 'Suggestions fetched', 200, { suggestions });
  } catch (error) {
    logger.error('Get suggestions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/search/elasticsearch/status:
 *   get:
 *     summary: Get Elasticsearch status
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  sendSuccess(res, 'Elasticsearch status', 200, {
    enabled: isEnabled(),
  });
}));

module.exports = router;






