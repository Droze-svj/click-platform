// Enhanced Approval Routes
// Advanced Kanban, SLA analytics, rich comments, visual diff, batch approvals, workflow automation

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { getKanbanBoardWithFilters, bulkMoveCards, getKanbanBoardWithSwimlanes, bulkUpdateCards } = require('../services/advancedKanbanService');
const { getSLAAnalytics, getSLAPredictions } = require('../services/slaAnalyticsService');
const { addRichComment, addCommentReaction, getCommentTemplates, createCommentTemplate } = require('../services/richCommentService');
const { generateVisualDiff, addDiffAnnotation } = require('../services/visualDiffService');
const { getApprovalHistory, getPendingApprovals, batchApproveDecline } = require('../services/batchApprovalService');
const { autoAdvanceApproval, routeConditionally, delegateApproval, createAutoAdvanceRule } = require('../services/workflowAutomationService');
const router = express.Router();

/**
 * GET /api/clients/:clientWorkspaceId/kanban/filtered
 * Get Kanban board with filters
 */
router.get('/:clientWorkspaceId/kanban/filtered', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, ...filters } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const board = await getKanbanBoardWithFilters(clientWorkspaceId, agencyWorkspaceId, filters);
  sendSuccess(res, 'Filtered Kanban board retrieved', 200, board);
}));

/**
 * GET /api/clients/:clientWorkspaceId/kanban/swimlanes
 * Get Kanban board with swimlanes
 */
router.get('/:clientWorkspaceId/kanban/swimlanes', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, swimlaneType = 'priority' } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const board = await getKanbanBoardWithSwimlanes(clientWorkspaceId, agencyWorkspaceId, swimlaneType);
  sendSuccess(res, 'Kanban board with swimlanes retrieved', 200, board);
}));

/**
 * POST /api/clients/:clientWorkspaceId/kanban/bulk-move
 * Bulk move cards
 */
router.post('/:clientWorkspaceId/kanban/bulk-move', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, cardIds, toColumnId } = req.body;

  if (!agencyWorkspaceId || !cardIds || !Array.isArray(cardIds) || !toColumnId) {
    return sendError(res, 'Agency workspace ID, cardIds array, and toColumnId are required', 400);
  }

  const userId = req.user._id;
  const result = await bulkMoveCards(clientWorkspaceId, agencyWorkspaceId, cardIds, toColumnId, userId);
  sendSuccess(res, 'Cards moved', 200, result);
}));

/**
 * POST /api/clients/:clientWorkspaceId/kanban/bulk-update
 * Bulk update cards
 */
router.post('/:clientWorkspaceId/kanban/bulk-update', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, cardIds, updates } = req.body;

  if (!agencyWorkspaceId || !cardIds || !Array.isArray(cardIds) || !updates) {
    return sendError(res, 'Agency workspace ID, cardIds array, and updates are required', 400);
  }

  const userId = req.user._id;
  const result = await bulkUpdateCards(clientWorkspaceId, agencyWorkspaceId, cardIds, updates, userId);
  sendSuccess(res, 'Cards updated', 200, result);
}));

/**
 * GET /api/clients/:clientWorkspaceId/sla/analytics
 * Get SLA analytics
 */
router.get('/:clientWorkspaceId/sla/analytics', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const analytics = await getSLAAnalytics(clientWorkspaceId, req.query);
  sendSuccess(res, 'SLA analytics retrieved', 200, analytics);
}));

/**
 * GET /api/clients/:clientWorkspaceId/sla/predictions
 * Get SLA predictions
 */
router.get('/:clientWorkspaceId/sla/predictions', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const predictions = await getSLAPredictions(clientWorkspaceId);
  sendSuccess(res, 'SLA predictions retrieved', 200, predictions);
}));

/**
 * POST /api/posts/:postId/comments/rich
 * Add rich text comment
 */
router.post('/:postId/comments/rich', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;
  const comment = await addRichComment(postId, { ...req.body, userId });
  sendSuccess(res, 'Rich comment added', 201, comment);
}));

/**
 * POST /api/posts/:postId/comments/:commentId/reaction
 * Add reaction to comment
 */
router.post('/:postId/comments/:commentId/reaction', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  const { reactionType } = req.body;

  if (!reactionType) {
    return sendError(res, 'Reaction type is required', 400);
  }

  const comment = await addCommentReaction(commentId, userId, reactionType);
  sendSuccess(res, 'Reaction added', 200, comment);
}));

/**
 * GET /api/workspaces/:workspaceId/comment-templates
 * Get comment templates
 */
router.get('/:workspaceId/comment-templates', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const templates = await getCommentTemplates(workspaceId, req.query);
  sendSuccess(res, 'Comment templates retrieved', 200, { templates });
}));

/**
 * POST /api/workspaces/:workspaceId/comment-templates
 * Create comment template
 */
router.post('/:workspaceId/comment-templates', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { agencyWorkspaceId, ...templateData } = req.body;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const template = await createCommentTemplate(workspaceId, agencyWorkspaceId, {
    ...templateData,
    createdBy: req.user._id
  });
  sendSuccess(res, 'Comment template created', 201, template);
}));

/**
 * GET /api/versions/:entityId/visual-diff
 * Get visual diff with highlighting
 */
router.get('/:entityId/visual-diff', auth, asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { version1, version2, entityType = 'content' } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const diff = await generateVisualDiff(entityId, parseInt(version1), parseInt(version2), entityType);
  sendSuccess(res, 'Visual diff generated', 200, diff);
}));

/**
 * POST /api/versions/:entityId/annotations
 * Add annotation to diff
 */
router.post('/:entityId/annotations', auth, asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { versionNumber, entityType = 'content', ...annotationData } = req.body;

  if (!versionNumber) {
    return sendError(res, 'Version number is required', 400);
  }

  const version = await addDiffAnnotation(entityId, versionNumber, {
    ...annotationData,
    userId: req.user._id
  }, entityType);
  sendSuccess(res, 'Annotation added', 201, version);
}));

/**
 * GET /api/simple-portal/:token/history
 * Get approval history
 */
router.get('/:token/history', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const history = await getApprovalHistory(token);
  sendSuccess(res, 'Approval history retrieved', 200, history);
}));

/**
 * GET /api/simple-portal/:token/pending
 * Get pending approvals for batch
 */
router.get('/:token/pending', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const pending = await getPendingApprovals(token);
  sendSuccess(res, 'Pending approvals retrieved', 200, pending);
}));

/**
 * POST /api/simple-portal/:token/batch
 * Batch approve/decline
 */
router.post('/:token/batch', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { actions } = req.body;

  if (!actions || !Array.isArray(actions)) {
    return sendError(res, 'Actions array is required', 400);
  }

  const result = await batchApproveDecline(token, actions);
  sendSuccess(res, 'Batch actions processed', 200, result);
}));

/**
 * POST /api/approvals/:approvalId/auto-advance
 * Auto-advance approval
 */
router.post('/:approvalId/auto-advance', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { rules } = req.body;

  if (!rules || !Array.isArray(rules)) {
    return sendError(res, 'Rules array is required', 400);
  }

  const result = await autoAdvanceApproval(approvalId, rules);
  sendSuccess(res, 'Auto-advance processed', 200, result);
}));

/**
 * POST /api/approvals/:approvalId/route
 * Conditionally route approval
 */
router.post('/:approvalId/route', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { routingRules } = req.body;

  if (!routingRules || !Array.isArray(routingRules)) {
    return sendError(res, 'Routing rules array is required', 400);
  }

  const result = await routeConditionally(approvalId, routingRules);
  sendSuccess(res, 'Conditional routing processed', 200, result);
}));

/**
 * POST /api/approvals/:approvalId/delegate
 * Delegate approval
 */
router.post('/:approvalId/delegate', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { toUserId, stageOrder, expiresAt } = req.body;

  if (!toUserId || stageOrder === undefined) {
    return sendError(res, 'toUserId and stageOrder are required', 400);
  }

  const fromUserId = req.user._id;
  const approval = await delegateApproval(approvalId, fromUserId, toUserId, stageOrder, expiresAt);
  sendSuccess(res, 'Approval delegated', 200, approval);
}));

/**
 * POST /api/workspaces/:workspaceId/auto-advance-rules
 * Create auto-advance rule
 */
router.post('/:workspaceId/auto-advance-rules', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const rule = await createAutoAdvanceRule(workspaceId, req.body);
  sendSuccess(res, 'Auto-advance rule created', 201, rule);
}));

module.exports = router;


