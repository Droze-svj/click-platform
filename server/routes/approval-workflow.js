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
  const status = await getApprovalStatus(approvalId);
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
  if (stage !== undefined) query.currentStage = parseInt(stage);

  if (assignedToMe === 'true') {
    query['assignedTo.userId'] = req.user._id;
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
  const approval = await ContentApproval.findById(approvalId)
    .populate('history.userId', 'name email')
    .select('history stages')
    .lean();

  if (!approval) {
    return sendError(res, 'Approval not found', 404);
  }

  sendSuccess(res, 'Audit trail retrieved', 200, {
    history: approval.history,
    stages: approval.stages.map(stage => ({
      order: stage.stageOrder,
      name: stage.stageName,
      status: stage.status,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      approvals: stage.approvals
    }))
  });
}));

module.exports = router;


