// Service Tiers Routes
// Service tier management

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createServiceTier,
  createDefaultTiers,
  assignTierToClient,
  getClientTier,
  updateTierUsage,
  checkTierLimits
} = require('../services/serviceTierService');
const ServiceTier = require('../models/ServiceTier');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/service-tiers
 * Create service tier
 */
router.post('/:agencyWorkspaceId/service-tiers', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const tier = await createServiceTier(agencyWorkspaceId, req.body);
  sendSuccess(res, 'Service tier created', 201, tier);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/service-tiers
 * Get service tiers
 */
router.get('/:agencyWorkspaceId/service-tiers', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const tiers = await ServiceTier.find({ agencyWorkspaceId, isActive: true })
    .sort({ order: 1 })
    .lean();

  sendSuccess(res, 'Service tiers retrieved', 200, { tiers });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/service-tiers/default
 * Create default tiers
 */
router.post('/:agencyWorkspaceId/service-tiers/default', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const tiers = await createDefaultTiers(agencyWorkspaceId);
  sendSuccess(res, 'Default tiers created', 201, { tiers });
}));

/**
 * POST /api/clients/:clientWorkspaceId/service-tier/assign
 * Assign tier to client
 */
router.post('/:clientWorkspaceId/service-tier/assign', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { tierId, upgrade, downgrade } = req.body;

  if (!tierId) {
    return sendError(res, 'Tier ID is required', 400);
  }

  const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
  if (!workspace || !workspace.agencyWorkspaceId) {
    return sendError(res, 'Client workspace not found or not associated with agency', 404);
  }

  const assignment = await assignTierToClient(clientWorkspaceId, workspace.agencyWorkspaceId, tierId, {
    userId: req.user._id,
    upgrade,
    downgrade
  });

  sendSuccess(res, 'Tier assigned to client', 200, assignment);
}));

/**
 * GET /api/clients/:clientWorkspaceId/service-tier
 * Get client tier
 */
router.get('/:clientWorkspaceId/service-tier', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const tier = await getClientTier(clientWorkspaceId);
  if (!tier) {
    return sendError(res, 'No tier assigned to client', 404);
  }
  sendSuccess(res, 'Client tier retrieved', 200, tier);
}));

/**
 * PUT /api/clients/:clientWorkspaceId/service-tier/usage
 * Update tier usage
 */
router.put('/:clientWorkspaceId/service-tier/usage', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const assignment = await updateTierUsage(clientWorkspaceId, req.body);
  sendSuccess(res, 'Tier usage updated', 200, assignment);
}));

/**
 * GET /api/clients/:clientWorkspaceId/service-tier/limits
 * Check tier limits
 */
router.get('/:clientWorkspaceId/service-tier/limits', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const limits = await checkTierLimits(clientWorkspaceId);
  sendSuccess(res, 'Tier limits checked', 200, limits);
}));

module.exports = router;


