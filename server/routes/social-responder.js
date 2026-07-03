// AI Comment/DM Responder routes
// Ingest an inbound comment/DM → AI-draft an on-brand reply → human-approval
// queue → (flag-gated) send. v1 ingest is an authed endpoint, not a public
// per-platform webhook.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { clampInt } = require('../utils/pagination');
const { capForPrompt } = require('../utils/promptSafe');
const personalization = require('../services/personalizationService');
const googleAI = require('../utils/googleAI');
const SocialReply = require('../models/SocialReply');
const responder = require('../services/socialResponderService');

/**
 * POST /api/responder/draft
 * Body: { platform, inboundText, externalCommentId?, author? }
 * Draft an on-brand reply and queue it for approval. Persists nothing to the
 * platform — this only creates a pending_approval SocialReply.
 */
router.post('/draft', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const { platform, inboundText, externalCommentId, author } = req.body || {};
  if (!platform || !SocialReply.PLATFORMS.includes(platform)) {
    return sendError(res, 'A valid platform is required', 400);
  }
  if (!inboundText || !String(inboundText).trim()) {
    return sendError(res, 'inboundText is required', 400);
  }

  const deps = {
    sanitize: capForPrompt,
    buildSystemPrompt: (opts) => personalization.buildPersonalizedSystemPrompt(opts),
    generate: (prompt, opts) => googleAI.generateContent(prompt, opts),
    assertBudget: (args) => req.assertBudget(args),
    recordUsage: (args) => req.recordAiUsage(args),
  };

  let composed;
  try {
    composed = await responder.composeDraft(req.user._id, { platform, externalCommentId, author, inboundText }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }

  const reply = await responder.createReply(composed.body);
  return sendSuccess(res, 'Reply drafted and queued for approval', 201, { reply });
}));

/** GET /api/responder/pending?limit=&skip= — replies awaiting approval. */
router.get('/pending', auth, asyncHandler(async (req, res) => {
  const limit = clampInt(req.query.limit, 50, 200, 1);
  const skip = clampInt(req.query.skip, 0, 100000, 0);
  const replies = await responder.listPending(req.user._id, { limit, skip });
  sendSuccess(res, 'Pending replies retrieved', 200, { replies });
}));

/** POST /api/responder/:id/approve — approve (optionally with an edited reply). */
router.post('/:id/approve', auth, asyncHandler(async (req, res) => {
  const editedReply = req.body && req.body.editedReply;
  const reply = await responder.approveReply(req.user._id, req.params.id, editedReply);
  sendSuccess(res, 'Reply approved', 200, { reply });
}));

/** POST /api/responder/:id/reject — reject a pending draft. */
router.post('/:id/reject', auth, asyncHandler(async (req, res) => {
  const reply = await responder.rejectReply(req.user._id, req.params.id);
  sendSuccess(res, 'Reply rejected', 200, { reply });
}));

/**
 * POST /api/responder/:id/send — send an approved reply.
 * Hard-gated: 501 unless SOCIAL_REPLY_SEND=true AND a platform adapter is wired.
 */
router.post('/:id/send', auth, asyncHandler(async (req, res) => {
  try {
    const reply = await responder.sendApprovedReply(req.user._id, req.params.id);
    sendSuccess(res, 'Reply sent', 200, { reply });
  } catch (err) {
    sendError(res, err.message, err.statusCode || 500);
  }
}));

module.exports = router;
