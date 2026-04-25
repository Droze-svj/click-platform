// Enhanced Cross-Client Features Routes
// Analytics, gap filling, alerts, bulk operations, trends

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  getTemplateAnalytics,
  getTemplateRecommendations
} = require('../services/templateAnalyticsService');
const {
  fillContentGaps,
  bulkFillGaps
} = require('../services/gapFillingService');
const {
  getClientAlerts,
  acknowledgeAlert,
  resolveAlert
} = require('../services/contentHealthAlertService');
const {
  bulkApplyTemplate
} = require('../services/bulkTemplateService');
const {
  getHealthTrends,
  getBenchmarkComparison
} = require('../services/contentHealthTrendsService');
const router = express.Router();

/**
 * GET /api/agency/:agencyWorkspaceId/templates/:templateId/analytics
 * Get template analytics
 */
router.get('/:agencyWorkspaceId/templates/:templateId/analytics', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const analytics = await getTemplateAnalytics(templateId, req.query);
  sendSuccess(res, 'Template analytics retrieved', 200, analytics);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/templates/recommendations
 * Get template recommendations
 */
router.get('/:agencyWorkspaceId/templates/recommendations', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const recommendations = await getTemplateRecommendations(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Template recommendations retrieved', 200, { recommendations });
}));

/**
 * POST /api/clients/:clientWorkspaceId/gaps/fill
 * Fill content gaps
 */
router.post('/:clientWorkspaceId/gaps/fill', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { gapData, ...options } = req.body;

  if (!gapData) {
    // Get latest health analysis
    const ContentHealth = require('../models/ContentHealth');
    const health = await ContentHealth.findOne({ clientWorkspaceId })
      .sort({ analysisDate: -1 })
      .lean();

    if (!health) {
      return sendError(res, 'No health analysis found. Please analyze content health first.', 404);
    }

    const result = await fillContentGaps(clientWorkspaceId, health, {
      ...options,
      userId: req.user._id
    });
    sendSuccess(res, 'Gaps filled', 200, result);
  } else {
    const result = await fillContentGaps(clientWorkspaceId, gapData, {
      ...options,
      userId: req.user._id
    });
    sendSuccess(res, 'Gaps filled', 200, result);
  }
}));

/**
 * POST /api/agency/:agencyWorkspaceId/gaps/bulk-fill
 * Bulk fill gaps across clients
 */
router.post('/:agencyWorkspaceId/gaps/bulk-fill', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const result = await bulkFillGaps(agencyWorkspaceId, {
    ...req.body,
    userId: req.user._id
  });
  sendSuccess(res, 'Bulk gap filling completed', 200, result);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health-alerts
 * Get health alerts
 */
router.get('/:clientWorkspaceId/health-alerts', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const alerts = await getClientAlerts(clientWorkspaceId, req.query);
  sendSuccess(res, 'Health alerts retrieved', 200, { alerts });
}));

/**
 * PUT /api/health-alerts/:alertId/acknowledge
 * Acknowledge alert
 */
router.put('/:alertId/acknowledge', auth, asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const alert = await acknowledgeAlert(alertId, req.user._id);
  sendSuccess(res, 'Alert acknowledged', 200, alert);
}));

/**
 * PUT /api/health-alerts/:alertId/resolve
 * Resolve alert
 */
router.put('/:alertId/resolve', auth, asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const alert = await resolveAlert(alertId, req.user._id);
  sendSuccess(res, 'Alert resolved', 200, alert);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/templates/:templateId/bulk-apply
 * Bulk apply template
 */
router.post('/:agencyWorkspaceId/templates/:templateId/bulk-apply', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { templateId, agencyWorkspaceId } = req.params;
  const result = await bulkApplyTemplate(templateId, agencyWorkspaceId, {
    ...req.body,
    userId: req.user._id
  });
  sendSuccess(res, 'Bulk template application completed', 200, result);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health/trends
 * Get health trends
 */
router.get('/:clientWorkspaceId/health/trends', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const trends = await getHealthTrends(clientWorkspaceId, req.query);
  sendSuccess(res, 'Health trends retrieved', 200, trends);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health/benchmark
 * Get benchmark comparison
 */
router.get('/:clientWorkspaceId/health/benchmark', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
  
  if (!workspace || !workspace.agencyWorkspaceId) {
    return sendError(res, 'Client workspace not found or not associated with agency', 404);
  }

  const comparison = await getBenchmarkComparison(clientWorkspaceId, workspace.agencyWorkspaceId);
  sendSuccess(res, 'Benchmark comparison retrieved', 200, comparison);
}));

module.exports = router;


