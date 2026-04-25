// Enhanced Workflow Routes
// Templates, SLA, delegation, bulk operations, analytics

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createWorkflowTemplate,
  createApprovalFromTemplate,
  getDefaultTemplate,
  createDefaultTemplates
} = require('../services/workflowTemplateService');
const {
  checkSLAStatus,
  getSLAAnalytics
} = require('../services/slaTrackingService');
const {
  bulkApprove,
  bulkReject,
  bulkRequestChanges
} = require('../services/bulkApprovalService');
const {
  delegateApproval,
  revokeDelegation,
  getUserDelegations
} = require('../services/approvalDelegationService');
const {
  getApprovalAnalytics,
  getApprovalDashboard
} = require('../services/approvalAnalyticsService');
const {
  restorePostVersion,
  getVersionRestoreHistory
} = require('../services/versionRestoreService');
const {
  searchComments,
  getCommentsByUser
} = require('../services/commentSearchService');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const ApprovalSLA = require('../models/ApprovalSLA');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/workflow-templates
 * Create workflow template
 */
router.post('/:agencyWorkspaceId/workflow-templates', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const template = await createWorkflowTemplate(agencyWorkspaceId, req.user._id, req.body);
  sendSuccess(res, 'Workflow template created', 201, template);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/workflow-templates
 * Get workflow templates
 */
router.get('/:agencyWorkspaceId/workflow-templates', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const templates = await WorkflowTemplate.find({ agencyWorkspaceId })
    .populate('createdBy', 'name email')
    .sort({ isDefault: -1, usageCount: -1 })
    .lean();

  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/workflow-templates/:templateId/use
 * Create approval from template
 */
router.post('/:agencyWorkspaceId/workflow-templates/:templateId/use', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { contentId, scheduledPostId, ...options } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const approval = await createApprovalFromTemplate(templateId, contentId, {
    ...options,
    workspaceId: req.body.workspaceId,
    createdBy: req.user._id,
    scheduledPostId
  });

  sendSuccess(res, 'Approval created from template', 201, approval);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/workflow-templates/default
 * Create default templates
 */
router.post('/:agencyWorkspaceId/workflow-templates/default', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const templates = await createDefaultTemplates(agencyWorkspaceId, req.user._id);
  sendSuccess(res, 'Default templates created', 201, { templates });
}));

/**
 * GET /api/approvals/:approvalId/sla
 * Get SLA status
 */
router.get('/:approvalId/sla', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const updates = await checkSLAStatus(approvalId);
  sendSuccess(res, 'SLA status checked', 200, { updates });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/approvals/analytics
 * Get approval analytics
 */
router.get('/:agencyWorkspaceId/approvals/analytics', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const analytics = await getApprovalAnalytics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/approvals/sla-analytics
 * Get SLA analytics
 */
router.get('/:agencyWorkspaceId/approvals/sla-analytics', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const analytics = await getSLAAnalytics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'SLA analytics retrieved', 200, analytics);
}));

/**
 * GET /api/approvals/dashboard
 * Get approval dashboard
 */
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  const dashboard = await getApprovalDashboard(req.user._id, req.query);
  sendSuccess(res, 'Dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/approvals/bulk/approve
 * Bulk approve
 */
router.post('/bulk/approve', auth, asyncHandler(async (req, res) => {
  const { approvalIds, comment = '' } = req.body;

  if (!approvalIds || !Array.isArray(approvalIds)) {
    return sendError(res, 'Approval IDs array is required', 400);
  }

  const result = await bulkApprove(approvalIds, req.user._id, comment);
  sendSuccess(res, 'Bulk approval completed', 200, result);
}));

/**
 * POST /api/approvals/bulk/reject
 * Bulk reject
 */
router.post('/bulk/reject', auth, asyncHandler(async (req, res) => {
  const { approvalIds, reason = '' } = req.body;

  if (!approvalIds || !Array.isArray(approvalIds)) {
    return sendError(res, 'Approval IDs array is required', 400);
  }

  const result = await bulkReject(approvalIds, req.user._id, reason);
  sendSuccess(res, 'Bulk rejection completed', 200, result);
}));

/**
 * POST /api/approvals/bulk/request-changes
 * Bulk request changes
 */
router.post('/bulk/request-changes', auth, asyncHandler(async (req, res) => {
  const { approvalIds, changes = '' } = req.body;

  if (!approvalIds || !Array.isArray(approvalIds)) {
    return sendError(res, 'Approval IDs array is required', 400);
  }

  const result = await bulkRequestChanges(approvalIds, req.user._id, changes);
  sendSuccess(res, 'Bulk request changes completed', 200, result);
}));

/**
 * POST /api/approvals/:approvalId/delegate
 * Delegate approval
 */
router.post('/:approvalId/delegate', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { stageOrder, toUserId, reason, expiresAt } = req.body;

  if (!stageOrder || !toUserId) {
    return sendError(res, 'Stage order and user ID are required', 400);
  }

  const delegation = await delegateApproval(approvalId, stageOrder, req.user._id, toUserId, {
    reason,
    expiresAt
  });

  sendSuccess(res, 'Approval delegated', 201, delegation);
}));

/**
 * GET /api/approvals/delegations
 * Get user delegations
 */
router.get('/delegations', auth, asyncHandler(async (req, res) => {
  const { type = 'all', status = 'active' } = req.query;
  const delegations = await getUserDelegations(req.user._id, { type, status });
  sendSuccess(res, 'Delegations retrieved', 200, { delegations });
}));

/**
 * PUT /api/approvals/delegations/:delegationId/revoke
 * Revoke delegation
 */
router.put('/delegations/:delegationId/revoke', auth, asyncHandler(async (req, res) => {
  const { delegationId } = req.params;
  const delegation = await revokeDelegation(delegationId, req.user._id);
  sendSuccess(res, 'Delegation revoked', 200, delegation);
}));

/**
 * POST /api/posts/:postId/versions/:versionNumber/restore
 * Restore to version
 */
router.post('/:postId/versions/:versionNumber/restore', auth, asyncHandler(async (req, res) => {
  const { postId, versionNumber } = req.params;
  const { reason = '' } = req.body;

  const post = await restorePostVersion(postId, versionNumber, req.user._id, reason);
  sendSuccess(res, 'Version restored', 200, post);
}));

/**
 * GET /api/posts/:postId/versions/restore-history
 * Get restore history
 */
router.get('/:postId/versions/restore-history', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const history = await getVersionRestoreHistory(postId);
  sendSuccess(res, 'Restore history retrieved', 200, { history });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/comments/search
 * Search comments
 */
router.get('/:agencyWorkspaceId/comments/search', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { q, ...filters } = req.query;

  if (!q) {
    return sendError(res, 'Search query is required', 400);
  }

  const results = await searchComments(agencyWorkspaceId, q, filters);
  sendSuccess(res, 'Comments found', 200, results);
}));

/**
 * GET /api/comments/user/:userId
 * Get comments by user
 */
router.get('/user/:userId', auth, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const comments = await getCommentsByUser(userId, req.query);
  sendSuccess(res, 'User comments retrieved', 200, { comments });
}));

module.exports = router;


