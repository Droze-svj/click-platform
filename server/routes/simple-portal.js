// Simple Client Portal Routes
// Ultra-simple approve/decline + comment interface

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { getSimpleApprovalView, processSimpleApproval, addSimpleComment } = require('../services/simpleClientPortalService');
const router = express.Router();

/**
 * GET /api/simple-portal/:token
 * Get simple approval view (no auth required - token-based)
 */
router.get('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const view = await getSimpleApprovalView(token);
  sendSuccess(res, 'Approval view retrieved', 200, view);
}));

/**
 * POST /api/simple-portal/:token/approve
 * Approve via simple portal
 */
router.post('/:token/approve', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment } = req.body;
  const result = await processSimpleApproval(token, 'approve', comment);
  sendSuccess(res, 'Content approved', 200, result);
}));

/**
 * POST /api/simple-portal/:token/decline
 * Decline via simple portal
 */
router.post('/:token/decline', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment } = req.body;
  const result = await processSimpleApproval(token, 'decline', comment);
  sendSuccess(res, 'Content declined', 200, result);
}));

/**
 * POST /api/simple-portal/:token/comment
 * Add comment via simple portal
 */
router.post('/:token/comment', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return sendError(res, 'Comment is required', 400);
  }

  const result = await addSimpleComment(token, comment);
  sendSuccess(res, 'Comment added', 200, result);
}));

module.exports = router;


