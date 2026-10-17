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
const logger = require('../utils/logger');
const multiStepWorkflowService = require('../services/multiStepWorkflowService');
// FIVE routers share the /api/approvals mount (this one, approval-workflow,
// workflow-enhanced, approval-kanban, approval-enhanced — see server/index.js),
// and this one is mounted first. Its `/:approvalId` routes therefore matched
// STATIC paths belonging to the later routers: POST /bulk/{approve,reject,
// request-changes}, GET /dashboard, GET /delegations, GET /sla-alerts all landed
// here with approvalId="bulk"/"dashboard"/… and never reached their real
// handlers. objectIdOrSkip declines a segment that is not an ObjectId so the
// request continues down the chain. The "declare static routes first" comment
// below only ever protected ordering WITHIN this file; it could not see across
// routers.
const { objectIdOrSkip } = require('../middleware/validateObjectId');
const mongoose = require('mongoose');
const validator = require('validator');
const ApprovalRequest = require('../models/ApprovalRequest');
const approvalService = require('../services/approvalService');
const router = express.Router();

// Two approval systems share this mount. The dashboard approvals page lists
// ApprovalRequest documents (one-step sign-offs, approvalService), but the
// approve/reject/cancel handlers below only knew ContentApproval (multi-step
// workflows), so every button on that page failed with "Approval not found" and
// its create form posted to a route that did not exist. An id that belongs to
// an ApprovalRequest is now handled by approvalService; any other id continues
// to the multi-step workflow code unchanged.
const isApprovalRequest = (id) => ApprovalRequest.exists({ _id: id });

// approvalService throws plain Errors; map them to honest status codes.
function sendApprovalRequestError(res, err) {
  const msg = err.message || 'Approval request failed';
  const status = /not found/i.test(msg) ? 404
    : /unauthorized|insufficient permissions/i.test(msg) ? 403
      : /not pending/i.test(msg) ? 409
        : 500;
  return sendError(res, msg, status);
}

// The global sanitizer HTML-escapes body strings; these are stored and later
// rendered as React text (which escapes again), so store the real characters.
const cleanText = (v, max) => (typeof v === 'string' ? validator.unescape(v).slice(0, max) : '');

const ENTITY_OWNER_MODELS = { content: 'Content', script: 'Script', post: 'ScheduledPost' };
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const isObjectId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v);

/**
 * POST /api/approvals
 * Request a one-step sign-off on something you own.
 * Body: { entityType: 'content'|'script'|'post', entityId, requestedFrom?, priority?, message?, teamId?, expiresIn? }
 * requestedFrom defaults to yourself (a creator signing off on AI output).
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const modelName = ENTITY_OWNER_MODELS[body.entityType];
  if (!modelName) return sendError(res, 'entityType must be content, script or post', 400);
  if (!isObjectId(body.entityId)) return sendError(res, 'A valid entityId is required', 400);

  const Model = require(`../models/${modelName}`);
  const owned = await Model.exists({ _id: body.entityId, userId: req.user._id });
  if (!owned) return sendError(res, `${body.entityType} not found`, 404);

  let requestedFrom = req.user._id;
  if (body.requestedFrom) {
    if (!isObjectId(body.requestedFrom)) return sendError(res, 'requestedFrom must be a user id', 400);
    const User = require('../models/User');
    if (!(await User.exists({ _id: body.requestedFrom }))) return sendError(res, 'Approver not found', 404);
    requestedFrom = body.requestedFrom;
  }

  const expiresIn = Number.parseInt(body.expiresIn, 10);
  try {
    const request = await approvalService.createApprovalRequest({
      entityType: body.entityType,
      entityId: body.entityId,
      requestedBy: req.user._id,
      requestedFrom,
      teamId: isObjectId(body.teamId) ? body.teamId : null,
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'medium',
      message: cleanText(body.message, 500),
      expiresIn: Number.isFinite(expiresIn) ? Math.min(720, Math.max(1, expiresIn)) : undefined,
    });
    return sendSuccess(res, 'Approval requested', 201, request);
  } catch (err) {
    return sendApprovalRequestError(res, err);
  }
}));

/**
 * GET /api/approvals/pending-count
 * Get pending approvals count for user
 *
 * IMPORTANT: This route MUST be declared before any dynamic `/:approvalId` routes,
 * otherwise Express will treat "pending-count" as an approvalId and route incorrectly.
 */
router.get('/pending-count', auth, asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      logger.warn('pending-count called without authenticated user');
      return sendSuccess(res, 'Pending count retrieved', 200, { count: 0 });
    }

    // Ensure userId is valid
    const userId = req.user._id;
    if (!userId) {
      logger.warn('pending-count called with invalid userId');
      return sendSuccess(res, 'Pending count retrieved', 200, { count: 0 });
    }

    const { getPendingApprovalsCount } = require('../services/approvalService');
    const userIdString = userId.toString ? userId.toString() : String(userId);
    const count = await getPendingApprovalsCount(userIdString);
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

/**
 * POST /api/approvals/workflows
 * Create approval workflow
 */
router.post('/workflows', auth, asyncHandler(async (req, res) => {
  const workflow = await createWorkflow(req.user._id, req.body);
  sendSuccess(res, 'Workflow created', 201, workflow);
}));

/**
 * GET /api/approvals
 * Get all approval requests for current user
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { status } = req.query;

  // Get approvals where user is either requester or approver
  const { getUserApprovalRequests } = require('../services/approvalService');
  const approvals = await getUserApprovalRequests(req.user._id, { status });

  sendSuccess(res, 'Approvals retrieved', 200, approvals);
}));

/**
 * GET /api/approvals/workflows
 * Get approval workflows
 */
router.get('/workflows', auth, asyncHandler(async (req, res) => {
  const { teamId } = req.query;
  // (1) String()-cast so a `?teamId[$ne]=x` operator object can't reach the Mongo
  // $or filter (NoSQL injection). (2) Only honor teamId if the caller is a member —
  // otherwise any team's workflows (approver names/emails, stage config) leak.
  let safeTeamId = null;
  if (teamId) {
    safeTeamId = String(teamId);
    const Team = require('../models/Team');
    const member = await Team.findOne({ _id: safeTeamId, 'members.userId': req.user._id })
      .select('_id').lean().catch(() => null);
    if (!member) safeTeamId = null; // not a member → fall back to the caller's own workflows
  }
  const workflows = await getWorkflows(req.user._id, safeTeamId);
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
router.post('/:approvalId/approve', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment } = req.body;

  if (await isApprovalRequest(approvalId)) {
    try {
      const request = await approvalService.approveRequest(approvalId, req.user._id, cleanText(req.body.response || comment, 2000));
      return sendSuccess(res, 'Approved', 200, request);
    } catch (err) {
      return sendApprovalRequestError(res, err);
    }
  }

  // Use the advanced multi-step service for stage advancement
  const approval = await multiStepWorkflowService.advanceToNextStage(approvalId, req.user._id, 'approve', comment || '');
  sendSuccess(res, 'Content approved and advanced to next stage', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/accept-v2
 * Accept AI-proposed revision and approve current stage
 */
router.post('/:approvalId/accept-v2', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { comment } = req.body;

  // Advance stage and MERGE V2 revisions
  const approval = await multiStepWorkflowService.advanceToNextStage(approvalId, req.user._id, 'approve', comment || '', true);
  sendSuccess(res, 'AI Revision accepted and stage approved', 200, approval);
}));

/**
 * POST /api/approvals/:approvalId/reject
 * Reject content
 */
router.post('/:approvalId/reject', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { rejectionReason, comment } = req.body;

  if (await isApprovalRequest(approvalId)) {
    try {
      const reason = cleanText(req.body.response || rejectionReason || comment, 2000);
      const request = await approvalService.rejectRequest(approvalId, req.user._id, reason);
      return sendSuccess(res, 'Rejected', 200, request);
    } catch (err) {
      return sendApprovalRequestError(res, err);
    }
  }

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
router.post('/:approvalId/request-changes', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
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
router.post('/:approvalId/resubmit', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
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
 * POST /api/approvals/:approvalId/cancel
 * Cancel approval process
 */
router.post('/:approvalId/cancel', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  if (await isApprovalRequest(approvalId)) {
    try {
      const request = await approvalService.cancelRequest(approvalId, req.user._id);
      return sendSuccess(res, 'Approval request cancelled', 200, request);
    } catch (err) {
      return sendApprovalRequestError(res, err);
    }
  }
  const approval = await cancelApproval(approvalId, req.user._id);
  sendSuccess(res, 'Approval cancelled', 200, approval);
}));

/**
 * GET /api/approvals/:approvalId
 * Get approval details
 */
router.get('/:approvalId', objectIdOrSkip('approvalId'), auth, asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const approval = await getApprovalDetails(approvalId, req.user._id);
  sendSuccess(res, 'Approval details retrieved', 200, approval);
}));

module.exports = router;
