// Traffic, Conversions, and Revenue Routes
// CTR, conversions, ROAS/ROI tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { trackClick, calculateCTR, getClickAnalytics } = require('../services/clickTrackingService');
const { trackConversion, getConversionAnalytics, getConversionFunnel } = require('../services/conversionTrackingService');
const { calculateROASROI, getROASROIDashboard } = require('../services/roasRoiService');
const {
  processConversionWebhook,
  processGoogleAnalyticsConversion,
  processShopifyConversion
} = require('../services/webhookConversionService');
const router = express.Router();

/**
 * POST /api/clicks/track
 * Track a click from social post
 */
router.post('/track', asyncHandler(async (req, res) => {
  const { postId, ...clickData } = req.body;

  if (!postId) {
    return sendError(res, 'Post ID is required', 400);
  }

  const click = await trackClick(postId, clickData);
  sendSuccess(res, 'Click tracked', 201, click);
}));

/**
 * GET /api/posts/:postId/clicks/analytics
 * Get click analytics for a post
 */
router.get('/:postId/clicks/analytics', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const analytics = await getClickAnalytics(postId, req.query);
  sendSuccess(res, 'Click analytics retrieved', 200, analytics);
}));

/**
 * POST /api/posts/:postId/ctr/calculate
 * Calculate CTR for a post
 */
router.post('/:postId/ctr/calculate', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const ctr = await calculateCTR(postId);
  sendSuccess(res, 'CTR calculated', 200, ctr);
}));

/**
 * POST /api/conversions/track
 * Track a conversion
 */
router.post('/track', asyncHandler(async (req, res) => {
  const { postId, ...conversionData } = req.body;

  if (!postId) {
    return sendError(res, 'Post ID is required', 400);
  }

  const conversion = await trackConversion(postId, conversionData);
  sendSuccess(res, 'Conversion tracked', 201, conversion);
}));

/**
 * GET /api/workspaces/:workspaceId/conversions/analytics
 * Get conversion analytics
 */
router.get('/:workspaceId/conversions/analytics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const analytics = await getConversionAnalytics(workspaceId, req.query);
  sendSuccess(res, 'Conversion analytics retrieved', 200, analytics);
}));

/**
 * GET /api/workspaces/:workspaceId/conversions/funnel
 * Get conversion funnel
 */
router.get('/:workspaceId/conversions/funnel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const funnel = await getConversionFunnel(workspaceId, req.query);
  sendSuccess(res, 'Conversion funnel retrieved', 200, funnel);
}));

/**
 * POST /api/workspaces/:workspaceId/roas-roi/calculate
 * Calculate ROAS/ROI
 */
router.post('/:workspaceId/roas-roi/calculate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period, ...filters } = req.body;

  if (!period || !period.startDate || !period.endDate) {
    return sendError(res, 'Period with startDate and endDate is required', 400);
  }

  const attribution = await calculateROASROI(workspaceId, period, filters);
  sendSuccess(res, 'ROAS/ROI calculated', 200, attribution);
}));

/**
 * GET /api/workspaces/:workspaceId/roas-roi/dashboard
 * Get ROAS/ROI dashboard
 */
router.get('/:workspaceId/roas-roi/dashboard', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const dashboard = await getROASROIDashboard(workspaceId, req.query);
  sendSuccess(res, 'ROAS/ROI dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/webhooks/conversions
 * Webhook endpoint for external conversion tracking
 */
router.post('/webhooks/conversions', asyncHandler(async (req, res) => {
  const { source, ...data } = req.body;

  let conversion;
  switch (source) {
    case 'google_analytics':
      conversion = await processGoogleAnalyticsConversion(data);
      break;
    case 'shopify':
      conversion = await processShopifyConversion(data);
      break;
    default:
      conversion = await processConversionWebhook({ source: source || 'external', ...data });
  }

  if (conversion) {
    sendSuccess(res, 'Conversion webhook processed', 200, conversion);
  } else {
    sendSuccess(res, 'Webhook received but no matching click found', 200, { processed: false });
  }
}));

module.exports = router;

