// Email Approval Routes
// Mobile-friendly email approval interface

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  processEmailApproval,
  getApprovalPreview
} = require('../services/emailApprovalService');
const EmailApprovalToken = require('../models/EmailApprovalToken');
const router = express.Router();

/**
 * GET /api/email-approval/:token
 * Get approval preview (mobile-friendly)
 */
router.get('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  try {
    const preview = await getApprovalPreview(token);
    sendSuccess(res, 'Approval preview retrieved', 200, preview);
  } catch (error) {
    return sendError(res, error.message || 'Invalid or expired token', 400);
  }
}));

/**
 * POST /api/email-approval/:token/approve
 * Approve via email link
 */
router.post('/:token/approve', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment = '' } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const result = await processEmailApproval(token, 'approve', comment, ipAddress, userAgent);

  if (!result.success) {
    return sendError(res, result.error || 'Approval failed', 400);
  }

  sendSuccess(res, result.message || 'Content approved successfully', 200, {
    approvalId: result.approvalId
  });
}));

/**
 * POST /api/email-approval/:token/reject
 * Reject via email link
 */
router.post('/:token/reject', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment = '', reason = '' } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Create reject token
  const approvalToken = await EmailApprovalToken.findOne({ token });
  if (!approvalToken) {
    return sendError(res, 'Invalid token', 400);
  }

  const rejectToken = new EmailApprovalToken({
    approvalId: approvalToken.approvalId,
    stageOrder: approvalToken.stageOrder,
    approverEmail: approvalToken.approverEmail,
    approverName: approvalToken.approverName,
    action: 'reject',
    expiresAt: approvalToken.expiresAt
  });
  await rejectToken.save();

  const result = await processEmailApproval(rejectToken.token, 'reject', comment || reason, ipAddress, userAgent);

  if (!result.success) {
    return sendError(res, result.error || 'Rejection failed', 400);
  }

  sendSuccess(res, result.message || 'Content rejected', 200, {
    approvalId: result.approvalId
  });
}));

/**
 * POST /api/email-approval/:token/request-changes
 * Request changes via email link
 */
router.post('/:token/request-changes', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment = '', changes = '' } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Create request changes token
  const approvalToken = await EmailApprovalToken.findOne({ token });
  if (!approvalToken) {
    return sendError(res, 'Invalid token', 400);
  }

  const changesToken = new EmailApprovalToken({
    approvalId: approvalToken.approvalId,
    stageOrder: approvalToken.stageOrder,
    approverEmail: approvalToken.approverEmail,
    approverName: approvalToken.approverName,
    action: 'request_changes',
    expiresAt: approvalToken.expiresAt
  });
  await changesToken.save();

  const result = await processEmailApproval(changesToken.token, 'request_changes', comment || changes, ipAddress, userAgent);

  if (!result.success) {
    return sendError(res, result.error || 'Request failed', 400);
  }

  sendSuccess(res, result.message || 'Changes requested', 200, {
    approvalId: result.approvalId
  });
}));

/**
 * GET /api/email-approval/:token/mobile
 * Mobile-friendly approval page data
 */
router.get('/:token/mobile', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  try {
    const preview = await getApprovalPreview(token);
    
    // Format for mobile-friendly display
    const mobileData = {
      approval: {
        id: preview.approval.id,
        content: {
          title: preview.approval.content.title || 'Content',
          type: preview.approval.content.type,
          preview: preview.approval.content.preview,
          fullText: preview.approval.content.preview // Would get full text in production
        },
        createdBy: preview.approval.createdBy,
        currentStage: {
          name: preview.approval.currentStage?.stageName,
          order: preview.approval.currentStage?.stageOrder
        },
        status: preview.approval.status
      },
      actions: {
        approve: `/api/email-approval/${token}/approve`,
        reject: `/api/email-approval/${token}/reject`,
        requestChanges: `/api/email-approval/${token}/request-changes`
      },
      expiresAt: preview.token.expiresAt,
      canApprove: true
    };

    sendSuccess(res, 'Mobile approval data retrieved', 200, mobileData);
  } catch (error) {
    return sendError(res, error.message || 'Invalid or expired token', 400);
  }
}));

module.exports = router;


