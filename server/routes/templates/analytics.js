// Template Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getCreatorAnalytics,
  getTemplateTrends,
} = require('../../services/templateAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/templates/analytics:
 *   get:
 *     summary: Get creator analytics
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const period = parseInt(req.query.period, 10) || 30;

  try {
    const analytics = await getCreatorAnalytics(req.user._id, period);
    sendSuccess(res, 'Analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get creator analytics error', { error: error.message });
    // Don't echo the raw error message to the client.
    sendError(res, 'Failed to load creator analytics', 500);
  }
}));

/**
 * @swagger
 * /api/templates/analytics/:templateId/trends:
 *   get:
 *     summary: Get template performance trends
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:templateId/trends', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const period = parseInt(req.query.period, 10) || 30;

  try {
    const trends = await getTemplateTrends(templateId, period);
    sendSuccess(res, 'Trends fetched', 200, trends);
  } catch (error) {
    // A missing template is a client-addressable 404, not a server fault. This
    // branch previously reported every error as a 500 (including the old
    // not-implemented stub, which is why this endpoint always 500'd).
    if (/not found/i.test(error.message)) {
      return sendError(res, 'Template not found', 404);
    }
    logger.error('Get trends error', { error: error.message, templateId });
    sendError(res, 'Failed to load template trends', 500);
  }
}));

module.exports = router;






