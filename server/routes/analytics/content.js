// Content analytics routes

const express = require('express');
const auth = require('../../middleware/auth');
const { getContentAnalytics, getContentInsights } = require('../../utils/contentAnalytics');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/content:
 *   get:
 *     summary: Get content analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const analytics = await getContentAnalytics(req.user._id, parseInt(period));
  sendSuccess(res, 'Content analytics fetched', 200, analytics);
}));

/**
 * @swagger
 * /api/analytics/content/insights:
 *   get:
 *     summary: Get content insights and recommendations
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/insights', auth, asyncHandler(async (req, res) => {
  // #region agent log
  // #endregion

  try {
    // #region agent log
    // #endregion

    const insights = await getContentInsights(req.user._id);

    // #region agent log
    // #endregion
    sendSuccess(res, 'Content insights fetched', 200, insights);
  } catch (error) {
    // #region agent log
    // #endregion
    throw error;
  }
}));

const { getVideoAnalyticsInsights } = require('../../services/videoAnalyticsService');

/**
 * @swagger
 * /api/analytics/content/editor-insights:
 *   get:
 *     summary: Get actionable AI video analytics insights for the editor
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/editor-insights', auth, asyncHandler(async (req, res) => {
  const insights = await getVideoAnalyticsInsights(req.user._id);
  sendSuccess(res, 'Editor analytics insights fetched', 200, insights);
}));

module.exports = router;







