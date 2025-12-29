// Advanced search routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  advancedSearch,
  getSearchSuggestions,
  getSearchFilters
} = require('../../services/advancedSearchService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/search/advanced:
 *   post:
 *     summary: Perform advanced search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    query = '',
    types = ['content', 'scripts', 'posts', 'templates'],
    filters = {},
    sortBy = 'relevance',
    sortOrder = 'desc',
    limit = 20,
    skip = 0
  } = req.body;

  const results = await advancedSearch(req.user._id, query, {
    types,
    filters,
    sortBy,
    sortOrder,
    limit: parseInt(limit),
    skip: parseInt(skip)
  });

  sendSuccess(res, 'Search completed', 200, results);
}));

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Get search suggestions
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return sendSuccess(res, 'Suggestions fetched', 200, []);
  }

  const suggestions = await getSearchSuggestions(req.user._id, q, parseInt(limit));
  sendSuccess(res, 'Suggestions fetched', 200, suggestions);
}));

/**
 * @swagger
 * /api/search/filters:
 *   get:
 *     summary: Get available search filters
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.get('/filters', auth, asyncHandler(async (req, res) => {
  const filters = await getSearchFilters(req.user._id);
  sendSuccess(res, 'Filters fetched', 200, filters);
}));

module.exports = router;







