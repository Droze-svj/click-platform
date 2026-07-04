// AI Comment/DM Responder
// Drafts an on-brand reply to an inbound comment/DM in the creator's voice, and
// queues it for HUMAN APPROVAL. Nothing is posted to a real platform without an
// explicit, flag-gated send step (SOCIAL_REPLY_SEND) AND a wired platform
// adapter — a draft can never auto-post.

const logger = require('../utils/logger');
const SocialReply = require('../models/SocialReply');

const REPLY_GUIDANCE = 'You are drafting a reply to a single inbound comment or DM. '
  + 'Keep it 1-3 sentences, natural, and on-brand. This is a DRAFT for human approval.';

/**
 * Pure: compose the full generation prompt from a personalised system prompt and
 * the inbound context. Grounding rules keep the reply honest and short.
 */
function buildReplyPrompt(systemPrompt, { platform, author, inboundText }) {
  const who = author ? `comment from @${author}` : 'comment';
  return `${systemPrompt || ''}

Task: draft a reply to the following ${platform} ${who}.
Comment:
"""
${inboundText}
"""
Rules:
- 1-3 sentences, natural and on-brand.
- Do NOT invent facts, prices, offers, dates, or commitments.
- Never promise anything the creator has not authorised.
- No "as an AI" phrasing. Output ONLY the reply text.`;
}

/** The text that will actually be sent: a human edit wins over the AI draft. */
function finalReplyText(reply) {
  if (!reply) return '';
  return (reply.editedReply != null && String(reply.editedReply).trim() !== '')
    ? reply.editedReply
    : (reply.draftReply || '');
}

/**
 * Sanitise the inbound text, build the persona prompt, and generate a draft.
 * Returns { body, prompt } — the ready-to-persist reply body and the prompt used.
 * All external calls are injected via `deps` so this is unit-testable without a
 * DB, the AI, or the personalization service:
 *   deps = { sanitize, buildSystemPrompt, generate, assertBudget?, recordUsage? }
 */
async function composeDraft(userId, input, deps) {
  const { platform, externalCommentId, author, inboundText } = input || {};
  const safe = deps.sanitize(inboundText, 2000);
  if (!safe || !String(safe).trim()) {
    const e = new Error('inboundText is required'); e.statusCode = 400; throw e;
  }

  // Freeform short text (not strict-JSON) so a copy-oriented persona is fine.
  const systemPrompt = await deps.buildSystemPrompt({
    userId, platform, role: 'copywriter', stage: 'reply', extra: REPLY_GUIDANCE,
  });
  const prompt = buildReplyPrompt(systemPrompt, { platform, author, inboundText: safe });

  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 300 });
  }
  const draft = await deps.generate(prompt, { maxTokens: 300, temperature: 0.6, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((draft || '').length / 4),
      taskType: 'social-reply-draft',
    });
  }

  return {
    prompt,
    body: {
      userId: String(userId),
      platform,
      externalCommentId: externalCommentId || null,
      author: author || null,
      inboundText: safe,
      draftReply: draft || '', // empty (AI quota) is fine — the human can write it
      status: 'pending_approval',
    },
  };
}

/** Persist a composed draft. */
async function createReply(body) {
  const doc = await SocialReply.create(body);
  logger.info('[responder] draft queued', { userId: body.userId, platform: body.platform, id: String(doc._id) });
  return doc;
}

/** List the caller's replies awaiting approval (paginated). */
async function listPending(userId, { limit = 50, skip = 0 } = {}) {
  return SocialReply.find({ userId: String(userId), status: 'pending_approval' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

const HISTORY_STATUSES = ['approved', 'sent', 'rejected', 'failed'];
const ALL_STATUSES = ['pending_approval', ...HISTORY_STATUSES];

/**
 * Responder KPI summary: reply counts by status over the last `sinceDays` days
 * (clamped 1–365 by the caller). Caller-scoped. Always returns every known status
 * key (zero-filled) so the UI can render a stable grid.
 */
async function getStats(userId, { sinceDays = 30 } = {}) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await SocialReply.aggregate([
    { $match: { userId: String(userId), createdAt: { $gte: since } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const r of rows) {
    if (r && r._id in byStatus) { byStatus[r._id] = r.count; total += r.count; }
  }
  return { sinceDays, total, byStatus };
}

/**
 * List the caller's resolved replies (approved/sent/rejected/failed) — the
 * responder history. `statuses` filters to a subset; unknown values are ignored
 * and fall back to all resolved statuses. Scoped to the caller (never leaks
 * pending drafts, which have their own endpoint).
 */
async function listHistory(userId, { statuses, limit = 50, skip = 0 } = {}) {
  const requested = Array.isArray(statuses)
    ? statuses.filter((s) => HISTORY_STATUSES.includes(s))
    : [];
  const use = requested.length ? requested : HISTORY_STATUSES;
  return SocialReply.find({ userId: String(userId), status: { $in: use } })
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/** Approve a pending draft (optionally with a human edit). Scoped to the caller. */
async function approveReply(userId, id, editedReply) {
  const doc = await SocialReply.findOne({ _id: id, userId: String(userId) });
  if (!doc) { const e = new Error('Reply not found'); e.statusCode = 404; throw e; }
  if (doc.status !== 'pending_approval') {
    const e = new Error(`Reply is ${doc.status}, not pending approval`); e.statusCode = 409; throw e;
  }
  if (editedReply != null) doc.editedReply = String(editedReply);
  doc.status = 'approved';
  doc.approvedBy = String(userId);
  doc.approvedAt = new Date();
  await doc.save();
  return doc;
}

/** Reject a pending draft. Scoped to the caller. */
async function rejectReply(userId, id) {
  const doc = await SocialReply.findOne({ _id: id, userId: String(userId) });
  if (!doc) { const e = new Error('Reply not found'); e.statusCode = 404; throw e; }
  if (doc.status !== 'pending_approval') {
    const e = new Error(`Reply is ${doc.status}, not pending approval`); e.statusCode = 409; throw e;
  }
  doc.status = 'rejected';
  await doc.save();
  return doc;
}

/**
 * Default send adapter: confirm the platform is connected, then dispatch to the
 * per-platform reply adapter (socialReplyAdapters). Unsupported platforms fail
 * closed with 501. Still only reached when SOCIAL_REPLY_SEND=true (enforced by
 * sendApprovedReply).
 */
async function defaultSender(userId, platform, externalCommentId, text) {
  const SocialConnection = require('../models/SocialConnection');
  const conn = await SocialConnection.findOne({ userId: String(userId), platform, isActive: true }).lean();
  if (!conn) { const e = new Error(`No connected ${platform} account`); e.statusCode = 400; throw e; }
  const { sendReply } = require('./socialReplyAdapters');
  return sendReply(userId, platform, externalCommentId, text);
}

/**
 * Send an APPROVED reply. Hard-gated: refuses unless SOCIAL_REPLY_SEND=true, and
 * even then only actually posts if a real `sender` adapter succeeds. Records the
 * outcome on the reply.
 */
async function sendApprovedReply(userId, id, sender = defaultSender) {
  if (String(process.env.SOCIAL_REPLY_SEND || '').toLowerCase() !== 'true') {
    const e = new Error('Reply sending is disabled (set SOCIAL_REPLY_SEND=true and wire a platform adapter)');
    e.statusCode = 501; throw e;
  }
  const doc = await SocialReply.findOne({ _id: id, userId: String(userId) });
  if (!doc) { const e = new Error('Reply not found'); e.statusCode = 404; throw e; }
  if (doc.status !== 'approved') {
    const e = new Error(`Reply is ${doc.status}, not approved`); e.statusCode = 409; throw e;
  }
  const text = finalReplyText(doc);
  try {
    await sender(String(userId), doc.platform, doc.externalCommentId, text);
    doc.status = 'sent';
    doc.sentAt = new Date();
    doc.sendError = null;
  } catch (err) {
    doc.status = 'failed';
    doc.sendError = err.message;
    await doc.save();
    throw err;
  }
  await doc.save();
  return doc;
}

module.exports = {
  REPLY_GUIDANCE,
  buildReplyPrompt,
  finalReplyText,
  composeDraft,
  createReply,
  listPending,
  listHistory,
  getStats,
  HISTORY_STATUSES,
  ALL_STATUSES,
  approveReply,
  rejectReply,
  sendApprovedReply,
  defaultSender,
};
