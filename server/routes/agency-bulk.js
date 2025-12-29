// Agency Bulk Operations Routes
// Enhanced bulk operations for agencies

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  bulkScheduleAcrossClients,
  bulkImportContent
} = require('../services/agencyService');
const {
  cloneCampaignToClients,
  applyClientGuidelines
} = require('../services/bulkCampaignService');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const ClientGuidelines = require('../models/ClientGuidelines');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/clone-campaign
 * Clone a campaign across multiple clients with customization
 */
router.post('/:agencyWorkspaceId/bulk/clone-campaign', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    campaignId,
    clientWorkspaceIds,
    customizeContent = true,
    applyBrandGuidelines = true,
    schedulePosts = true,
    customDates = null
  } = req.body;

  if (!campaignId || !clientWorkspaceIds || !Array.isArray(clientWorkspaceIds)) {
    return sendError(res, 'Campaign ID and client workspace IDs are required', 400);
  }

  const result = await cloneCampaignToClients(campaignId, clientWorkspaceIds, {
    customizeContent,
    applyBrandGuidelines,
    schedulePosts,
    customDates
  });

  sendSuccess(res, 'Campaign cloned to clients', 200, result);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/clone-content
 * Clone content across multiple clients with brand customization
 */
router.post('/:agencyWorkspaceId/bulk/clone-content', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    contentId,
    clientWorkspaceIds,
    applyBrandGuidelines = true,
    customizeText = true,
    schedulePosts = false
  } = req.body;

  if (!contentId || !clientWorkspaceIds || !Array.isArray(clientWorkspaceIds)) {
    return sendError(res, 'Content ID and client workspace IDs are required', 400);
  }

  const sourceContent = await Content.findById(contentId);
  if (!sourceContent) {
    return sendError(res, 'Source content not found', 404);
  }

  const results = [];

  for (const clientWorkspaceId of clientWorkspaceIds) {
    try {
      // Get client guidelines
      const guidelines = await ClientGuidelines.findOne({ workspaceId: clientWorkspaceId });

      // Customize content
      let customizedContent = {
        title: sourceContent.title,
        description: sourceContent.description,
        text: sourceContent.content?.text || sourceContent.description,
        mediaUrl: sourceContent.originalFile?.url || sourceContent.generatedContent?.socialPosts?.[0]?.mediaUrl,
        hashtags: sourceContent.tags || [],
        platforms: sourceContent.platforms || []
      };

      if (applyBrandGuidelines && guidelines) {
        customizedContent = applyClientGuidelines(customizedContent, guidelines, {});
      }

      // Create content for client
      const Workspace = require('../models/Workspace');
      const clientWorkspace = await Workspace.findById(clientWorkspaceId);
      const ownerId = clientWorkspace.ownerId;

      const newContent = new Content({
        userId: ownerId,
        workspaceId: clientWorkspaceId,
        clientWorkspaceId,
        agencyWorkspaceId,
        title: customizedContent.title,
        description: customizedContent.description,
        content: {
          text: customizedContent.text
        },
        type: sourceContent.type,
        platforms: customizedContent.platforms,
        tags: customizedContent.hashtags,
        metadata: {
          clonedFrom: contentId,
          clonedAt: new Date(),
          originalContentId: contentId
        }
      });

      await newContent.save();
      results.push({
        clientWorkspaceId,
        success: true,
        contentId: newContent._id
      });
    } catch (error) {
      logger.error('Error cloning content to client', {
        error: error.message,
        contentId,
        clientWorkspaceId
      });
      results.push({
        clientWorkspaceId,
        success: false,
        error: error.message
      });
    }
  }

  sendSuccess(res, 'Content cloned to clients', 200, {
    total: clientWorkspaceIds.length,
    successful: results.filter(r => r.success).length,
    results
  });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/schedule
 * Bulk schedule content across clients (enhanced)
 */
router.post('/:agencyWorkspaceId/bulk/schedule', auth, requireWorkspaceAccess('canSchedule'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const scheduleData = {
    ...req.body,
    agencyWorkspaceId
  };

  const result = await bulkScheduleAcrossClients(agencyWorkspaceId, scheduleData);
  sendSuccess(res, 'Content bulk scheduled', 200, result);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/import
 * Bulk import content for client (enhanced)
 */
router.post('/:agencyWorkspaceId/bulk/import', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { clientId, importData } = req.body;

  if (!clientId) {
    return sendError(res, 'Client workspace ID is required', 400);
  }

  const result = await bulkImportContent(agencyWorkspaceId, clientId, importData);
  sendSuccess(res, 'Content bulk imported', 200, result);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/customize-and-schedule
 * Customize content for multiple clients and schedule in one flow
 */
router.post('/:agencyWorkspaceId/bulk/customize-and-schedule', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    contentId,
    clientWorkspaceIds,
    customizations = {}, // Per-client customizations
    scheduleOptions = {}
  } = req.body;

  if (!contentId || !clientWorkspaceIds || !Array.isArray(clientWorkspaceIds)) {
    return sendError(res, 'Content ID and client workspace IDs are required', 400);
  }

  const sourceContent = await Content.findById(contentId);
  if (!sourceContent) {
    return sendError(res, 'Source content not found', 404);
  }

  const results = [];

  for (const clientWorkspaceId of clientWorkspaceIds) {
    try {
      // Get client-specific customization
      const clientCustomization = customizations[clientWorkspaceId.toString()] || {};

      // Get client guidelines
      const guidelines = await ClientGuidelines.findOne({ workspaceId: clientWorkspaceId });

      // Customize content
      let customizedContent = {
        title: clientCustomization.title || sourceContent.title,
        description: clientCustomization.description || sourceContent.description,
        text: clientCustomization.text || sourceContent.content?.text || sourceContent.description,
        mediaUrl: clientCustomization.mediaUrl || sourceContent.originalFile?.url,
        hashtags: clientCustomization.hashtags || sourceContent.tags || [],
        platforms: clientCustomization.platforms || sourceContent.platforms || []
      };

      if (guidelines) {
        customizedContent = applyClientGuidelines(customizedContent, guidelines, {});
      }

      // Create content
      const Workspace = require('../models/Workspace');
      const clientWorkspace = await Workspace.findById(clientWorkspaceId);
      const ownerId = clientWorkspace.ownerId;

      const newContent = new Content({
        userId: ownerId,
        workspaceId: clientWorkspaceId,
        clientWorkspaceId,
        agencyWorkspaceId,
        title: customizedContent.title,
        description: customizedContent.description,
        content: {
          text: customizedContent.text
        },
        type: sourceContent.type,
        platforms: customizedContent.platforms,
        tags: customizedContent.hashtags,
        metadata: {
          clonedFrom: contentId,
          customized: true,
          customization: clientCustomization
        }
      });

      await newContent.save();

      // Schedule if requested
      let scheduledPosts = [];
      if (scheduleOptions.enabled) {
        const ScheduledPost = require('../models/ScheduledPost');
        const { getOptimalPostingTimes } = require('../services/smartScheduleOptimizationService');

        for (const platform of customizedContent.platforms) {
          const scheduledTime = scheduleOptions.customDates?.[clientWorkspaceId]?.[platform] ||
            scheduleOptions.scheduledTime ||
            new Date();

          const scheduledPost = new ScheduledPost({
            userId: ownerId,
            workspaceId: clientWorkspaceId,
            clientWorkspaceId,
            agencyWorkspaceId,
            contentId: newContent._id,
            platform,
            content: {
              text: customizedContent.text,
              mediaUrl: customizedContent.mediaUrl,
              hashtags: customizedContent.hashtags
            },
            scheduledTime,
            timezone: scheduleOptions.timezone || 'UTC',
            status: 'scheduled'
          });

          await scheduledPost.save();
          scheduledPosts.push(scheduledPost._id);
        }
      }

      results.push({
        clientWorkspaceId,
        success: true,
        contentId: newContent._id,
        scheduledPosts: scheduledPosts.length
      });
    } catch (error) {
      logger.error('Error customizing and scheduling for client', {
        error: error.message,
        contentId,
        clientWorkspaceId
      });
      results.push({
        clientWorkspaceId,
        success: false,
        error: error.message
      });
    }
  }

  sendSuccess(res, 'Content customized and scheduled', 200, {
    total: clientWorkspaceIds.length,
    successful: results.filter(r => r.success).length,
    results
  });
}));

module.exports = router;


