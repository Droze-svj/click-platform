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
const { supportedPlatforms } = require('../services/socialReplyAdapters');

/**
 * GET /api/responder/platforms
 * The platforms a draft can target, each flagged with whether an outbound send
 * adapter is actually wired (`canSend`). Lets the UI avoid offering a platform
 * (e.g. tiktok) whose approved reply would 501 on send. `sendEnabled` reflects
 * the global SOCIAL_REPLY_SEND gate.
 */
router.get('/platforms', auth, asyncHandler(async (req, res) => {
  const sendable = new Set(supportedPlatforms());
  const platforms = SocialReply.PLATFORMS.map((name) => ({ name, canSend: sendable.has(name) }));
  sendSuccess(res, 'Responder platforms retrieved', 200, {
    platforms,
    sendEnabled: process.env.SOCIAL_REPLY_SEND === 'true',
  });
}));

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

/**
 * GET /api/responder/stats?days=30
 * Reply counts by status over the last N days (KPI summary). Caller-scoped.
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const sinceDays = clampInt(req.query.days, 30, 365, 1);
  const stats = await responder.getStats(req.user._id, { sinceDays });
  sendSuccess(res, 'Responder stats retrieved', 200, stats);
}));

/**
 * GET /api/responder/history?status=sent,rejected&limit=&skip=
 * Resolved replies (approved/sent/rejected/failed) — the responder history.
 * Optional comma-separated `status` filter; unknown values are dropped.
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const limit = clampInt(req.query.limit, 50, 200, 1);
  const skip = clampInt(req.query.skip, 0, 100000, 0);
  const statuses = typeof req.query.status === 'string' && req.query.status.trim()
    ? req.query.status.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const replies = await responder.listHistory(req.user._id, { statuses, limit, skip });
  sendSuccess(res, 'Responder history retrieved', 200, { replies });
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
