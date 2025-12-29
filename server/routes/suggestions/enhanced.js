// Enhanced suggestions routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getTrendingTopics,
  getContentGaps,
  getViralPredictions,
  getEnhancedSuggestions
} = require('../../services/enhancedSuggestionsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/suggestions/enhanced:
 *   get:
 *     summary: Get enhanced content suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const {
    niche = 'general',
    count = 10,
    includeTrending = true,
    includeGaps = true,
    includeSeasonal = true
  } = req.query;

  const suggestions = await getEnhancedSuggestions(req.user._id, {
    niche,
    count: parseInt(count),
    includeTrending: includeTrending === 'true',
    includeGaps: includeGaps === 'true',
    includeSeasonal: includeSeasonal === 'true'
  });

  sendSuccess(res, 'Enhanced suggestions fetched', 200, suggestions);
}));

/**
 * @swagger
 * /api/suggestions/trending:
 *   get:
 *     summary: Get trending topics
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trending', auth, asyncHandler(async (req, res) => {
  const { niche = 'general' } = req.query;
  const topics = await getTrendingTopics(niche);
  sendSuccess(res, 'Trending topics fetched', 200, topics);
}));

/**
 * @swagger
 * /api/suggestions/gaps:
 *   get:
 *     summary: Get content gap analysis
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/gaps', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const gaps = await getContentGaps(req.user._id, parseInt(period));
  sendSuccess(res, 'Content gaps fetched', 200, gaps);
}));

/**
 * @swagger
 * /api/suggestions/viral-prediction:
 *   post:
 *     summary: Get viral content prediction
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/viral-prediction', auth, asyncHandler(async (req, res) => {
  const { contentData } = req.body;

  if (!contentData) {
    return sendError(res, 'contentData is required', 400);
  }

  const prediction = await getViralPredictions(req.user._id, contentData);
  sendSuccess(res, 'Viral prediction fetched', 200, prediction);
}));

module.exports = router;







