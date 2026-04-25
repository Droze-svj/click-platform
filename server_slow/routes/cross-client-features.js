// Cross-Client Features Routes
// Templates, content health, gap analysis, evergreen queues

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createCrossClientTemplate,
  applyTemplateToContent,
  getAgencyTemplates,
  createDefaultTemplates
} = require('../services/crossClientTemplateService');
const {
  analyzeContentHealth,
  getRollUpView
} = require('../services/contentHealthService');
const {
  createEvergreenQueue,
  populateEvergreenQueue,
  autoScheduleFromQueue,
  refreshEvergreenQueue,
  getClientEvergreenQueues
} = require('../services/evergreenQueueService');
const CrossClientTemplate = require('../models/CrossClientTemplate');
const ContentHealth = require('../models/ContentHealth');
const EvergreenQueue = require('../models/EvergreenQueue');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/cross-client-templates
 * Create cross-client template
 */
router.post('/:agencyWorkspaceId/cross-client-templates', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const template = await createCrossClientTemplate(agencyWorkspaceId, req.user._id, req.body);
  sendSuccess(res, 'Cross-client template created', 201, template);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/cross-client-templates
 * Get agency templates
 */
router.get('/:agencyWorkspaceId/cross-client-templates', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const templates = await getAgencyTemplates(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/cross-client-templates/:templateId/apply
 * Apply template to content
 */
router.post('/:agencyWorkspaceId/cross-client-templates/:templateId/apply', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { contentId, clientWorkspaceId, autoSchedule = false, scheduledTime } = req.body;

  if (!contentId || !clientWorkspaceId) {
    return sendError(res, 'Content ID and client workspace ID are required', 400);
  }

  const result = await applyTemplateToContent(templateId, contentId, clientWorkspaceId, {
    autoSchedule,
    scheduledTime,
    userId: req.user._id
  });

  sendSuccess(res, 'Template applied successfully', 200, result);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/cross-client-templates/default
 * Create default templates
 */
router.post('/:agencyWorkspaceId/cross-client-templates/default', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const templates = await createDefaultTemplates(agencyWorkspaceId, req.user._id);
  sendSuccess(res, 'Default templates created', 201, { templates });
}));

/**
 * POST /api/clients/:clientWorkspaceId/content-health/analyze
 * Analyze content health
 */
router.post('/:clientWorkspaceId/content-health/analyze', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
  
  if (!workspace || !workspace.agencyWorkspaceId) {
    return sendError(res, 'Client workspace not found or not associated with agency', 404);
  }

  const health = await analyzeContentHealth(clientWorkspaceId, workspace.agencyWorkspaceId, req.body);
  sendSuccess(res, 'Content health analyzed', 200, health);
}));

/**
 * GET /api/clients/:clientWorkspaceId/content-health
 * Get content health history
 */
router.get('/:clientWorkspaceId/content-health', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { limit = 10 } = req.query;

  const healthRecords = await ContentHealth.find({ clientWorkspaceId })
    .sort({ analysisDate: -1 })
    .limit(parseInt(limit))
    .lean();

  sendSuccess(res, 'Content health history retrieved', 200, { health: healthRecords });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/content-health/rollup
 * Get roll-up view by niche/platform
 */
router.get('/:agencyWorkspaceId/content-health/rollup', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const rollUp = await getRollUpView(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Roll-up view retrieved', 200, { rollUp });
}));

/**
 * POST /api/clients/:clientWorkspaceId/evergreen-queues
 * Create evergreen queue
 */
router.post('/:clientWorkspaceId/evergreen-queues', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
  
  if (!workspace || !workspace.agencyWorkspaceId) {
    return sendError(res, 'Client workspace not found or not associated with agency', 404);
  }

  const queue = await createEvergreenQueue(
    clientWorkspaceId,
    workspace.agencyWorkspaceId,
    req.user._id,
    req.body
  );

  sendSuccess(res, 'Evergreen queue created', 201, queue);
}));

/**
 * GET /api/clients/:clientWorkspaceId/evergreen-queues
 * Get client evergreen queues
 */
router.get('/:clientWorkspaceId/evergreen-queues', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const queues = await getClientEvergreenQueues(clientWorkspaceId, req.query);
  sendSuccess(res, 'Evergreen queues retrieved', 200, { queues });
}));

/**
 * POST /api/evergreen-queues/:queueId/populate
 * Populate queue with evergreen content
 */
router.post('/:queueId/populate', auth, asyncHandler(async (req, res) => {
  const { queueId } = req.params;
  const result = await populateEvergreenQueue(queueId, req.body);
  sendSuccess(res, 'Queue populated', 200, result);
}));

/**
 * POST /api/evergreen-queues/:queueId/auto-schedule
 * Auto-schedule from queue
 */
router.post('/:queueId/auto-schedule', auth, asyncHandler(async (req, res) => {
  const { queueId } = req.params;
  const result = await autoScheduleFromQueue(queueId, req.body);
  sendSuccess(res, 'Auto-scheduled from queue', 200, result);
}));

/**
 * POST /api/evergreen-queues/:queueId/refresh
 * Refresh queue items
 */
router.post('/:queueId/refresh', auth, asyncHandler(async (req, res) => {
  const { queueId } = req.params;
  const result = await refreshEvergreenQueue(queueId);
  sendSuccess(res, 'Queue refreshed', 200, result);
}));

module.exports = router;


