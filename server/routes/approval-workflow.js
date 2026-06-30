// Multi-Step Approval Workflow Routes
// Creator → Internal Reviewer → Client Approver → Scheduled

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createMultiStepApproval,
  advanceToNextStage,
  getApprovalStatus
} = require('../services/multiStepWorkflowService');
const ContentApproval = require('../models/ContentApproval');
const router = express.Router();

/**
 * POST /api/approvals/multi-step
 * Create multi-step approval
 */
router.post('/multi-step', auth, asyncHandler(async (req, res) => {
  const {
    contentId,
    workspaceId,
    internalReviewerId,
    clientApproverId,
    clientApproverEmail,
    scheduledPostId
  } = req.body;

  if (!contentId || !workspaceId) {
    return sendError(res, 'Content ID and workspace ID are required', 400);
  }

  const approval = await createMultiStepApproval(contentId, {
    workspaceId,
    createdBy: req.user._id,
    internalReviewerId,
    clientApproverId,
    clientApproverEmail,
    scheduledPostId
  });

  sendSuccess(res, 'Multi-step approval created', 201, approval);
}));

/**
 * GET /api/approvals/:approvalId/status
 * Get approval status with audit trail
 */
router.get('/:approvalId/status', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const status = await getApprovalStatus(approvalId, req.user._id);
  sendSuccess(res, 'Approval status retrieved', 200, status);
}));

/**
 * POST /api/approvals/:approvalId/approve
 * Approve current stage
 */
router.post('/:approvalId/approve', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment = '' } = req.body;

  const approval = await advanceToNextStage(approvalId, req.user._id, 'approve', comment);
  sendSuccess(res, 'Approval stage advanced', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/reject
 * Reject approval
 */
router.post('/:approvalId/reject', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment = '', reason = '' } = req.body;

  const approval = await advanceToNextStage(approvalId, req.user._id, 'reject', comment || reason);
  sendSuccess(res, 'Approval rejected', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/request-changes
 * Request changes
 */
router.post('/:approvalId/request-changes', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment = '', changes = '' } = req.body;

  const approval = await advanceToNextStage(approvalId, req.user._id, 'request_changes', comment || changes);
  sendSuccess(res, 'Changes requested', 200, approval);
}));

/**
 * GET /api/approvals
 * Get approvals for user/workspace
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const {
    workspaceId,
    status,
    stage,
    assignedToMe = false
  } = req.query;

  const query = {};
  if (workspaceId) query.workspaceId = workspaceId;
  if (status) query.status = status;
  if (stage !== undefined) query.currentStage = parseInt(stage, 10);

  // SECURITY: never return the whole collection. Constrain to approvals the
  // caller participates in (created or is assigned to) — previously an empty
  // query (no workspaceId, assignedToMe!=true) returned ANY tenant's approvals.
  if (assignedToMe === 'true') {
    query['assignedTo.userId'] = req.user._id;
  } else {
    query.$or = [
      { createdBy: req.user._id },
      { 'assignedTo.userId': req.user._id },
    ];
  }

  const approvals = await ContentApproval.find(query)
    .populate('contentId', 'title type')
    .populate('createdBy', 'name email')
    .populate('stages.approvals.approverId', 'name email')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendSuccess(res, 'Approvals retrieved', 200, { approvals });
}));

/**
 * GET /api/approvals/:approvalId/audit-trail
 * Get audit trail
 */
router.get('/:approvalId/audit-trail', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const uid = req.user._id;
  // Scope to participants (creator / assignee / approver) — was an unscoped leak.
  const approval = await ContentApproval.findOne({
    _id: approvalId,
    $or: [
      { createdBy: uid },
      { 'assignedTo.userId': uid },
      { 'stages.approvals.approverId': uid },
    ],
  })
    .populate('history.userId', 'name email')
    .select('history stages')
    .lean();

  if (!approval) {
    return sendError(res, 'Approval not found', 404);
  }

  sendSuccess(res, 'Audit trail retrieved', 200, {
    history: approval.history || [],
    // Guard: an approval without stages (legacy/partial doc) must not 500 the audit trail.
    stages: (approval.stages || []).map(stage => ({
      order: stage.stageOrder,
      name: stage.stageName,
      status: stage.status,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      approvals: stage.approvals
    }))
  });
}));

// ── Inline collaboration: comment threads + revision history ──
const approvalCollab = require('../services/approvalCollaborationService');

// POST /api/approvals/:approvalId/comments — add an inline comment (optionally on
// a specific field / as a threaded reply).
router.post('/:approvalId/comments', auth, asyncHandler(async (req, res) => {
  const { text, targetField, parentId, authorRole } = req.body || {};
  const comment = await approvalCollab.addComment(req.params.approvalId, {
    authorId: req.user._id, authorName: req.user.name, authorRole, text, targetField, parentId,
  });
  sendSuccess(res, 'Comment added', 201, comment);
}));

// POST /api/approvals/:approvalId/comments/:commentId/resolve
router.post('/:approvalId/comments/:commentId/resolve', auth, asyncHandler(async (req, res) => {
  const resolved = !(req.body && req.body.resolved === false);
  const comment = await approvalCollab.resolveComment(req.params.approvalId, req.params.commentId, resolved);
  sendSuccess(res, 'Comment updated', 200, comment);
}));

// POST /api/approvals/:approvalId/revisions — creator re-submits after changes.
router.post('/:approvalId/revisions', auth, asyncHandler(async (req, res) => {
  const rev = await approvalCollab.addRevision(req.params.approvalId, {
    changedBy: req.user._id, note: req.body && req.body.note, changes: req.body && req.body.changes,
  });
  sendSuccess(res, 'Revision recorded', 201, rev);
}));

module.exports = router;


