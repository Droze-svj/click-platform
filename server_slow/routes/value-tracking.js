// Value Tracking Routes
// Cost, value, and ROI tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  calculateValueTracking,
  getClientValueTracking,
  getAgencyValueTracking
} = require('../services/valueTrackingService');
const router = express.Router();

/**
 * POST /api/clients/:clientWorkspaceId/value-tracking/calculate
 * Calculate value tracking for period
 */
router.post('/:clientWorkspaceId/value-tracking/calculate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { startDate, endDate, campaignId, ...options } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
  if (!workspace || !workspace.agencyWorkspaceId) {
    return sendError(res, 'Client workspace not found or not associated with agency', 404);
  }

  const tracking = await calculateValueTracking(
    clientWorkspaceId,
    workspace.agencyWorkspaceId,
    { startDate, endDate },
    {
      campaignId,
      ...options
    }
  );

  sendSuccess(res, 'Value tracking calculated', 200, tracking);
}));

/**
 * GET /api/clients/:clientWorkspaceId/value-tracking
 * Get value tracking for client
 */
router.get('/:clientWorkspaceId/value-tracking', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const tracking = await getClientValueTracking(clientWorkspaceId, req.query);
  sendSuccess(res, 'Value tracking retrieved', 200, { tracking });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/value-tracking
 * Get aggregated value tracking for agency
 */
router.get('/:agencyWorkspaceId/value-tracking', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const tracking = await getAgencyValueTracking(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Agency value tracking retrieved', 200, tracking);
}));

module.exports = router;


