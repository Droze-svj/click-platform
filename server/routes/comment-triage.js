// Comment Triage route
// POST /api/triage — rank a batch of inbound comments by reply priority.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { triageComments } = require('../services/commentTriageService');

const MAX_COMMENTS = 500;

/**
 * POST /api/triage
 * Body: { comments: [{ id?, text, author?, likes? }] }
 * Returns the comments ranked by reply priority (complaints/leads/questions
 * first, praise low, spam flagged) with per-comment intent + score + counts.
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const comments = req.body && req.body.comments;
  if (!Array.isArray(comments) || comments.length === 0) {
    return sendError(res, 'comments array is required', 400);
  }
  if (comments.length > MAX_COMMENTS) {
    return sendError(res, `Too many comments (max ${MAX_COMMENTS} per request)`, 400);
  }
  const result = triageComments(comments);
  sendSuccess(res, 'Comments triaged', 200, result);
}));

module.exports = router;
