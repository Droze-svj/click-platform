// Agency Campaign Routes
// Bulk campaign operations

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createCampaign,
  cloneCampaignToClients,
  updateCampaignForClients
} = require('../services/bulkCampaignService');
const { requireWorkspaceAccess, requireAgencyClientAccess } = require('../middleware/workspaceIsolation');
const Campaign = require('../models/Campaign');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/campaigns
 * Create campaign template
 */
router.post('/:agencyWorkspaceId/campaigns', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const campaign = await createCampaign(agencyWorkspaceId, req.user._id, req.body);
  sendSuccess(res, 'Campaign created', 201, campaign);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/campaigns
 * Get all campaigns
 */
router.get('/:agencyWorkspaceId/campaigns', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { status, search } = req.query;

  const query = { agencyWorkspaceId };
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const campaigns = await Campaign.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Campaigns retrieved', 200, { campaigns });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/campaigns/:campaignId
 * Get campaign details
 */
router.get('/:agencyWorkspaceId/campaigns/:campaignId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const campaign = await Campaign.findById(campaignId)
    .populate('createdBy', 'name email')
    .populate('clientInstances.clientWorkspaceId', 'name')
    .populate('clientInstances.scheduledPosts')
    .lean();

  if (!campaign) {
    return sendError(res, 'Campaign not found', 404);
  }

  sendSuccess(res, 'Campaign retrieved', 200, campaign);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/clone
 * Clone campaign to multiple clients
 */
router.post('/:agencyWorkspaceId/campaigns/:campaignId/clone', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { clientWorkspaceIds, options = {} } = req.body;

  if (!clientWorkspaceIds || !Array.isArray(clientWorkspaceIds) || clientWorkspaceIds.length === 0) {
    return sendError(res, 'Client workspace IDs are required', 400);
  }

  const result = await cloneCampaignToClients(campaignId, clientWorkspaceIds, options);
  sendSuccess(res, 'Campaign cloned to clients', 200, result);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/campaigns/:campaignId/update-clients
 * Update campaign for specific clients
 */
router.put('/:agencyWorkspaceId/campaigns/:campaignId/update-clients', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { clientWorkspaceIds, updates } = req.body;

  if (!clientWorkspaceIds || !Array.isArray(clientWorkspaceIds) || clientWorkspaceIds.length === 0) {
    return sendError(res, 'Client workspace IDs are required', 400);
  }

  if (!updates) {
    return sendError(res, 'Updates are required', 400);
  }

  const result = await updateCampaignForClients(campaignId, clientWorkspaceIds, updates);
  sendSuccess(res, 'Campaign updated for clients', 200, result);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/campaigns/:campaignId
 * Update campaign template
 */
router.put('/:agencyWorkspaceId/campaigns/:campaignId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    return sendError(res, 'Campaign not found', 404);
  }

  Object.assign(campaign, req.body);
  await campaign.save();

  sendSuccess(res, 'Campaign updated', 200, campaign);
}));

/**
 * DELETE /api/agency/:agencyWorkspaceId/campaigns/:campaignId
 * Delete campaign
 */
router.delete('/:agencyWorkspaceId/campaigns/:campaignId', auth, requireWorkspaceAccess('canDelete'), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    return sendError(res, 'Campaign not found', 404);
  }

  // Archive instead of delete
  campaign.status = 'archived';
  await campaign.save();

  sendSuccess(res, 'Campaign archived', 200, { id: campaignId });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/customize
 * Customize campaign content for specific client
 */
router.post('/:agencyWorkspaceId/campaigns/:campaignId/customize', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { clientWorkspaceId, customizedContent, brandGuidelines } = req.body;

  if (!clientWorkspaceId) {
    return sendError(res, 'Client workspace ID is required', 400);
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    return sendError(res, 'Campaign not found', 404);
  }

  const instance = campaign.clientInstances.find(
    inst => inst.clientWorkspaceId.toString() === clientWorkspaceId.toString()
  );

  if (instance) {
    // Update existing instance
    if (customizedContent) {
      instance.customizedContent = { ...instance.customizedContent, ...customizedContent };
    }
    if (brandGuidelines) {
      instance.brandGuidelines = { ...instance.brandGuidelines, ...brandGuidelines };
    }
  } else {
    // Create new instance
    campaign.clientInstances.push({
      clientWorkspaceId,
      customizedContent: customizedContent || campaign.templateContent,
      brandGuidelines: brandGuidelines || campaign.brandGuidelines,
      status: 'draft'
    });
  }

  await campaign.save();
  sendSuccess(res, 'Campaign customized for client', 200, campaign);
}));

module.exports = router;


