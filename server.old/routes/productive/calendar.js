// Content Calendar Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getContentCalendar,
  getOptimalPostingTimes,
  suggestCalendarGaps,
  bulkScheduleContent,
} = require('../../services/contentCalendarService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/productive/calendar:
 *   get:
 *     summary: Get content calendar
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    platforms,
  } = req.query;

  try {
    const calendar = await getContentCalendar(req.user._id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      platforms: platforms ? platforms.split(',') : null,
    });
    sendSuccess(res, 'Content calendar fetched', 200, calendar);
  } catch (error) {
    logger.error('Get content calendar error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/calendar/optimal-times:
 *   get:
 *     summary: Get optimal posting times
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/optimal-times', auth, asyncHandler(async (req, res) => {
  const { platforms } = req.query;

  try {
    const optimalTimes = await getOptimalPostingTimes(
      req.user._id,
      platforms ? platforms.split(',') : null
    );
    sendSuccess(res, 'Optimal posting times fetched', 200, optimalTimes);
  } catch (error) {
    logger.error('Get optimal posting times error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/calendar/gaps:
 *   get:
 *     summary: Suggest calendar gaps
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/gaps', auth, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    platforms,
    minPostsPerWeek,
  } = req.query;

  try {
    const gaps = await suggestCalendarGaps(req.user._id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      platforms: platforms ? platforms.split(',') : ['instagram', 'twitter', 'linkedin'],
      minPostsPerWeek: minPostsPerWeek ? parseInt(minPostsPerWeek) : 3,
    });
    sendSuccess(res, 'Calendar gaps analyzed', 200, gaps);
  } catch (error) {
    logger.error('Suggest calendar gaps error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/calendar/bulk-schedule:
 *   post:
 *     summary: Bulk schedule content
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk-schedule', auth, asyncHandler(async (req, res) => {
  const { contentIds, startDate, platforms, frequency } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  if (!startDate || !platforms || !Array.isArray(platforms)) {
    return sendError(res, 'Start date and platforms array are required', 400);
  }

  try {
    const result = await bulkScheduleContent(req.user._id, {
      contentIds,
      startDate: new Date(startDate),
      platforms,
      frequency: frequency || 'daily',
    });
    sendSuccess(res, 'Content bulk scheduled', 200, result);
  } catch (error) {
    logger.error('Bulk schedule content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// Import smart scheduling routes
const {
  smartScheduleContent,
  optimizeContentMix,
  planSeasonalContent,
} = require('../../services/smartSchedulingService');

/**
 * @swagger
 * /api/productive/calendar/smart-schedule:
 *   post:
 *     summary: Smart schedule content
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/smart-schedule', auth, asyncHandler(async (req, res) => {
  const { contentId, platforms, preferredTimes, avoidTimes, minSpacing } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  try {
    const result = await smartScheduleContent(req.user._id, contentId, {
      platforms: platforms || ['instagram', 'twitter', 'linkedin'],
      preferredTimes,
      avoidTimes,
      minSpacing: minSpacing || 2,
    });
    sendSuccess(res, 'Content smart scheduled', 200, result);
  } catch (error) {
    logger.error('Smart schedule content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/calendar/optimize-mix:
 *   get:
 *     summary: Optimize content mix
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/optimize-mix', auth, asyncHandler(async (req, res) => {
  const dateRange = parseInt(req.query.dateRange) || 7;

  try {
    const result = await optimizeContentMix(req.user._id, dateRange);
    sendSuccess(res, 'Content mix optimized', 200, result);
  } catch (error) {
    logger.error('Optimize content mix error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/calendar/seasonal:
 *   get:
 *     summary: Plan seasonal content
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/seasonal', auth, asyncHandler(async (req, res) => {
  const { season, platforms } = req.query;

  try {
    const result = await planSeasonalContent(
      req.user._id,
      season,
      platforms ? platforms.split(',') : ['instagram', 'twitter', 'linkedin']
    );
    sendSuccess(res, 'Seasonal content planned', 200, result);
  } catch (error) {
    logger.error('Plan seasonal content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

