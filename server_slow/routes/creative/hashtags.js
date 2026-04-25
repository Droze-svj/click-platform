// Hashtag Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  generateHashtags,
  analyzeHashtagPerformance,
  getTrendingHashtags,
} = require('../../services/hashtagService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/creative/hashtags/generate:
 *   post:
 *     summary: Generate hashtags
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const { contentText, platform, count, includeTrending, includeNiche } = req.body;

  if (!contentText) {
    return sendError(res, 'Content text is required', 400);
  }

  try {
    const hashtags = await generateHashtags(contentText, {
      platform: platform || 'instagram',
      count: count || 20,
      includeTrending: includeTrending !== false,
      includeNiche: includeNiche !== false,
    });
    sendSuccess(res, 'Hashtags generated', 200, hashtags);
  } catch (error) {
    logger.error('Generate hashtags error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/hashtags/analyze:
 *   post:
 *     summary: Analyze hashtag performance
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  const { hashtags } = req.body;

  if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
    return sendError(res, 'Hashtags array is required', 400);
  }

  try {
    const performance = await analyzeHashtagPerformance(req.user._id, hashtags);
    sendSuccess(res, 'Hashtag performance analyzed', 200, performance);
  } catch (error) {
    logger.error('Analyze hashtag performance error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/hashtags/trending:
 *   get:
 *     summary: Get trending hashtags
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trending', auth, asyncHandler(async (req, res) => {
  const { platform, category } = req.query;

  try {
    const trends = await getTrendingHashtags(platform || 'instagram', category);
    sendSuccess(res, 'Trending hashtags fetched', 200, trends);
  } catch (error) {
    logger.error('Get trending hashtags error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// Import hashtag research routes
const {
  researchHashtag,
  getCompetitorHashtags,
  predictHashtagPerformance,
} = require('../../services/hashtagResearchService');

/**
 * @swagger
 * /api/creative/hashtags/research:
 *   get:
 *     summary: Research hashtag
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/research', auth, asyncHandler(async (req, res) => {
  const { hashtag, platform } = req.query;

  if (!hashtag) {
    return sendError(res, 'Hashtag is required', 400);
  }

  try {
    const research = await researchHashtag(hashtag, platform || 'instagram');
    sendSuccess(res, 'Hashtag researched', 200, research);
  } catch (error) {
    logger.error('Research hashtag error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/hashtags/competitor:
 *   get:
 *     summary: Get competitor hashtags
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.get('/competitor', auth, asyncHandler(async (req, res) => {
  const { competitorUsername, platform } = req.query;

  if (!competitorUsername) {
    return sendError(res, 'Competitor username is required', 400);
  }

  try {
    const analysis = await getCompetitorHashtags(competitorUsername, platform || 'instagram');
    sendSuccess(res, 'Competitor hashtags analyzed', 200, analysis);
  } catch (error) {
    logger.error('Get competitor hashtags error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/creative/hashtags/predict:
 *   post:
 *     summary: Predict hashtag performance
 *     tags: [Creative]
 *     security:
 *       - bearerAuth: []
 */
router.post('/predict', auth, asyncHandler(async (req, res) => {
  const { hashtags, contentText, platform } = req.body;

  if (!hashtags || !Array.isArray(hashtags) || !contentText) {
    return sendError(res, 'Hashtags array and content text are required', 400);
  }

  try {
    const prediction = await predictHashtagPerformance(hashtags, contentText, platform || 'instagram');
    sendSuccess(res, 'Hashtag performance predicted', 200, prediction);
  } catch (error) {
    logger.error('Predict hashtag performance error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

