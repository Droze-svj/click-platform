// Agency Routes
// Multi-client management, white-label portals, bulk operations

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createWhiteLabelPortal,
  bulkScheduleAcrossClients,
  bulkImportContent,
  getClientApprovalDashboard,
  getCrossClientBenchmarking,
  getAgencyDashboard,
  startClientOnboarding,
  executeOnboardingStep,
  generateClientReport,
  trackClientUsage,
  getClientPerformanceAlerts
} = require('../services/agencyService');
const { checkPermission } = require('../services/workspaceService');

const router = express.Router();

/**
 * GET /api/agency/dashboard
 * Get agency dashboard overview
 */
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  // Find agency workspace for user
  const { getUserWorkspaces } = require('../services/workspaceService');
  const workspaces = await getUserWorkspaces(req.user._id, 'agency');
  
  if (workspaces.length === 0) {
    return sendError(res, 'No agency workspace found', 404);
  }

  const agencyWorkspaceId = workspaces[0]._id;
  const dashboard = await getAgencyDashboard(agencyWorkspaceId);
  sendSuccess(res, 'Agency dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/agency/portals
 * Create white-label portal
 */
router.post('/portals', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId, ...portalData } = req.body;

  if (!agencyWorkspaceId || !clientWorkspaceId) {
    return sendError(res, 'Agency and client workspace IDs are required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const portal = await createWhiteLabelPortal(agencyWorkspaceId, clientWorkspaceId, portalData);
  sendSuccess(res, 'White-label portal created', 201, portal);
}));

/**
 * GET /api/agency/portals
 * Get all portals for agency
 */
router.get('/portals', auth, asyncHandler(async (req, res) => {
  const { getUserWorkspaces } = require('../services/workspaceService');
  const workspaces = await getUserWorkspaces(req.user._id, 'agency');
  
  if (workspaces.length === 0) {
    return sendError(res, 'No agency workspace found', 404);
  }

  const agencyWorkspaceId = workspaces[0]._id;
  const WhiteLabelPortal = require('../models/WhiteLabelPortal');
  const portals = await WhiteLabelPortal.find({ workspaceId: agencyWorkspaceId })
    .populate('clientId', 'name')
    .lean();

  sendSuccess(res, 'Portals retrieved', 200, { portals });
}));

/**
 * POST /api/agency/bulk-schedule
 * Bulk schedule across multiple clients
 */
router.post('/bulk-schedule', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, ...scheduleData } = req.body;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canSchedule');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const results = await bulkScheduleAcrossClients(agencyWorkspaceId, scheduleData);
  sendSuccess(res, 'Bulk scheduling completed', 200, results);
}));

/**
 * POST /api/agency/bulk-import
 * Bulk import content
 */
router.post('/bulk-import', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientId, ...importData } = req.body;

  if (!agencyWorkspaceId || !clientId) {
    return sendError(res, 'Agency and client workspace IDs are required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canCreate');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const results = await bulkImportContent(agencyWorkspaceId, clientId, importData);
  sendSuccess(res, 'Bulk import completed', 200, results);
}));

/**
 * GET /api/agency/approvals/dashboard
 * Get client approval dashboard
 */
router.get('/approvals/dashboard', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientId = null } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const dashboard = await getClientApprovalDashboard(agencyWorkspaceId, clientId);
  sendSuccess(res, 'Approval dashboard retrieved', 200, dashboard);
}));

/**
 * GET /api/agency/benchmarking
 * Get cross-client benchmarking
 */
router.get('/benchmarking', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, timeframe = '30days' } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const benchmarking = await getCrossClientBenchmarking(agencyWorkspaceId, timeframe);
  sendSuccess(res, 'Cross-client benchmarking retrieved', 200, benchmarking);
}));

/**
 * POST /api/agency/onboarding/start
 * Start client onboarding
 */
router.post('/onboarding/start', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, ...clientData } = req.body;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canManageMembers');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const result = await startClientOnboarding(agencyWorkspaceId, clientData);
  sendSuccess(res, 'Client onboarding started', 201, result);
}));

/**
 * POST /api/agency/onboarding/:onboardingId/step
 * Execute onboarding step
 */
router.post('/onboarding/:onboardingId/step', auth, asyncHandler(async (req, res) => {
  const { onboardingId } = req.params;
  const { stepNumber } = req.body;

  const result = await executeOnboardingStep(onboardingId, stepNumber || 0);
  sendSuccess(res, 'Onboarding step executed', 200, result);
}));

/**
 * POST /api/agency/reports/generate
 * Generate white-label client report
 */
router.post('/reports/generate', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId, ...reportData } = req.body;

  if (!agencyWorkspaceId || !clientWorkspaceId) {
    return sendError(res, 'Agency and client workspace IDs are required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const report = await generateClientReport(agencyWorkspaceId, clientWorkspaceId, reportData);
  sendSuccess(res, 'Client report generated', 200, report);
}));

/**
 * POST /api/agency/billing/track
 * Track client usage and billing
 */
router.post('/billing/track', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId, period = null } = req.body;

  if (!agencyWorkspaceId || !clientWorkspaceId) {
    return sendError(res, 'Agency and client workspace IDs are required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canManageBilling');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const billing = await trackClientUsage(agencyWorkspaceId, clientWorkspaceId, period);
  sendSuccess(res, 'Client usage tracked', 200, billing);
}));

/**
 * GET /api/agency/alerts
 * Get client performance alerts
 */
router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId = null } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, agencyWorkspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const alerts = await getClientPerformanceAlerts(agencyWorkspaceId, clientWorkspaceId);
  sendSuccess(res, 'Performance alerts retrieved', 200, { alerts });
}));

module.exports = router;

