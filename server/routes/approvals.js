// Approval Workflow Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  createWorkflow,
  getWorkflows,
  startApprovalProcess,
  approveContent,
  rejectContent,
  requestChanges,
  resubmitContent,
  getUserApprovals,
  getApprovalDetails,
  cancelApproval
} = require('../services/approvalWorkflowService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * POST /api/approvals/workflows
 * Create approval workflow
 */
router.post('/workflows', auth, asyncHandler(async (req, res) => {
  const workflow = await createWorkflow(req.user._id, req.body);
  sendSuccess(res, 'Workflow created', 201, workflow);
}));

/**
 * GET /api/approvals/workflows
 * Get approval workflows
 */
router.get('/workflows', auth, asyncHandler(async (req, res) => {
  const { teamId } = req.query;
  const workflows = await getWorkflows(req.user._id, teamId);
  sendSuccess(res, 'Workflows retrieved', 200, { workflows });
}));

/**
 * POST /api/approvals/start
 * Start approval process for content
 */
router.post('/start', auth, asyncHandler(async (req, res) => {
  const { contentId, workflowId } = req.body;

  if (!contentId || !workflowId) {
    return sendError(res, 'Content ID and Workflow ID are required', 400);
  }

  const approval = await startApprovalProcess(contentId, workflowId, req.user._id);
  sendSuccess(res, 'Approval process started', 201, approval);
}));

/**
 * POST /api/approvals/:approvalId/approve
 * Approve content
 */
router.post('/:approvalId/approve', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment } = req.body;

  const approval = await approveContent(approvalId, req.user._id, comment || '');
  sendSuccess(res, 'Content approved', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/reject
 * Reject content
 */
router.post('/:approvalId/reject', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { rejectionReason, comment } = req.body;

  if (!rejectionReason) {
    return sendError(res, 'Rejection reason is required', 400);
  }

  const approval = await rejectContent(approvalId, req.user._id, rejectionReason, comment || '');
  sendSuccess(res, 'Content rejected', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/request-changes
 * Request changes
 */
router.post('/:approvalId/request-changes', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { requestedChanges, comment } = req.body;

  if (!requestedChanges) {
    return sendError(res, 'Requested changes are required', 400);
  }

  const approval = await requestChanges(approvalId, req.user._id, requestedChanges, comment || '');
  sendSuccess(res, 'Changes requested', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/resubmit
 * Resubmit content after changes
 */
router.post('/:approvalId/resubmit', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;

  const approval = await resubmitContent(approvalId, req.user._id);
  sendSuccess(res, 'Content resubmitted', 200, approval);
}));

/**
 * GET /api/approvals/my-approvals
 * Get approvals assigned to user
 */
router.get('/my-approvals', auth, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const approvals = await getUserApprovals(req.user._id, status);
  sendSuccess(res, 'Approvals retrieved', 200, { approvals });
}));

/**
 * GET /api/approvals/:approvalId
 * Get approval details
 */
router.get('/:approvalId', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const approval = await getApprovalDetails(approvalId, req.user._id);
  sendSuccess(res, 'Approval details retrieved', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/cancel
 * Cancel approval process
 */
router.post('/:approvalId/cancel', auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const approval = await cancelApproval(approvalId, req.user._id);
  sendSuccess(res, 'Approval cancelled', 200, approval);
}));

/**
 * GET /api/approvals/pending-count
 * Get pending approvals count for user
 */
router.get('/pending-count', auth, asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendError(res, 'User not authenticated', 401);
    }

    const { getPendingApprovalsCount } = require('../services/approvalService');
    const count = await getPendingApprovalsCount(req.user._id.toString());
    sendSuccess(res, 'Pending count retrieved', 200, { count: count || 0 });
  } catch (error) {
    logger.error('Error fetching pending approvals count', { 
      error: error.message, 
      userId: req.user?._id,
      stack: error.stack 
    });
    sendSuccess(res, 'Pending count retrieved', 200, { count: 0 });
  }
}));

module.exports = router;
