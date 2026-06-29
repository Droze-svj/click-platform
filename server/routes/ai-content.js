// AI Content Routes
// Confidence scoring, AI templates, assisted editing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { sendSuccess, sendError } = require('../utils/response');
const { guardOwnership } = require('../utils/ownership');
const { verifyWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { analyzeContentConfidence, getContentConfidence } = require('../services/aiConfidenceService');
const { createOrUpdateTemplate, getTemplates, generateContentWithTemplate } = require('../services/aiTemplateService');
const { generateVariants, improveSection, rewriteForTone, generateHookVariations } = require('../services/assistedEditingService');
const aiAgentWritingService = require('../services/aiAgentWritingService');
const AITemplate = require('../models/AITemplate');
const Script = require('../models/Script');
const router = express.Router();

// AI generation is the expensive cost-attack vector. Apply aiLimiter to all
// POSTs (writes/generations); leave GETs (cheap reads) under the global limit.
router.use((req, res, next) => {
  if (req.method === 'POST') return aiLimiter(req, res, next);
  return next();
});

// Attach req.assertBudget / req.recordAiUsage so each generation handler can
// enforce the per-tier aiBudgetUsd ceiling (free $0.50 … agency $500) and meter
// spend. Previously NONE of these routes consulted the budget, so the $ meter
// stayed 0 forever — rate limiting alone bounded request COUNT, not $ spend.
router.use(costGuard());

// Gate one AI generation against the caller's remaining budget, then return a
// recorder to call after the LLM work. Sends a 402 (with the upgrade payload)
// and returns null when over budget — the caller aborts. These routes call
// Gemini, so estimate against the gemini rate card. `out` should bound the
// worst-case output tokens (× count for fan-out routes).
async function withAiBudget(req, res, { prompt, out, taskType }) {
  const base = { provider: 'gemini', model: 'default' };
  let r;
  try {
    r = await req.assertBudget({ ...base, prompt: String(prompt || ''), expectedOutputTokens: out });
  } catch (e) {
    if (e.statusCode === 402) { res.status(402).json({ success: false, error: e.message, ...e.payload }); return null; }
    throw e;
  }
  const est = r.estimate;
  return () => req.recordAiUsage({ ...base, inputTokens: est.inputTokens, outputTokens: est.outputTokens, taskType }).catch(() => {});
}

// Hard cap on per-request variant/hook fan-out. Each variant is one LLM call, so
// an unclamped `count` from the body (e.g. 100000) was a cost bomb — one allowed
// request could issue 100k paid generations. Clamp to a sane absolute max.
const MAX_GEN_VARIANTS = 10;
function clampCount(v) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(1, Number.isFinite(n) ? n : 5), MAX_GEN_VARIANTS);
}

// A template is accessible to its creator or to any member of its owning agency
// workspace. Templates carry proprietary prompts/brand rules, so every lookup
// must pass this (otherwise any authed user could read/generate-on a competitor's
// template by guessing the id).
async function canAccessTemplate(template, req) {
  if (!template) return false;
  const uid = String(req.user?._id || req.user?.id || '');
  if (template.createdBy && String(template.createdBy) === uid) return true;
  if (template.agencyWorkspaceId) {
    try {
      const a = await verifyWorkspaceAccess(req.user._id, template.agencyWorkspaceId);
      if (a.allowed) return true;
    } catch (_) { /* fail closed */ }
  }
  return false;
}

/**
 * POST /api/ai/generate-script
 * Generate role-based master script
 */
router.post('/generate-script', auth, asyncHandler(async (req, res) => {
  const { topic, tone, role } = req.body;

  if (!topic) {
    return sendError(res, 'Topic is required', 400);
  }

  // Personalize: pass the creator so the script is written in their learned voice.
  const userId = req.user?._id?.toString() || req.user?.id;
  const record = await withAiBudget(req, res, { prompt: topic, out: 4000, taskType: 'generate-script' });
  if (!record) return;
  const result = await aiAgentWritingService.generateMasterScript(topic, tone, role, userId);
  record();
  sendSuccess(res, 'Master script generated', 200, result);
}));

/**
 * POST /api/ai/save-master-script
 * Save a generated master script (hook/body/cta) to user's scripts library
 */
router.post('/save-master-script', auth, asyncHandler(async (req, res) => {
  const { topic, tone, role, script } = req.body;
  const userId = req.user?._id || req.user?.id;
  const isDevUser = require('../utils/devUser').isDevUser(userId);

  if (!topic || !script || typeof script !== 'object') {
    return sendError(res, 'Topic and script (hook/body/cta) are required', 400);
  }

  const fullText = [script.hook, script.body, script.cta].filter(Boolean).join('\n\n---\n\n');
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const title = topic.slice(0, 80) + (topic.length > 80 ? '…' : '');
  const payload = {
    title,
    type: 'master',
    topic,
    tone: tone || 'professional',
    wordCount,
    script: fullText,
    structure: {
      introduction: script.hook || '',
      mainPoints: script.body ? [{ title: 'Value delivery', content: script.body, duration: null }] : [],
      conclusion: '',
      callToAction: script.cta || ''
    },
    metadata: {
      keywords: Array.isArray(script.psychological_triggers) ? script.psychological_triggers : [],
      hashtags: Array.isArray(script.hooks_used) ? script.hooks_used : [],
      timestamps: []
    },
    status: 'completed'
  };

  const mongoose = require('mongoose');
  const userIdStr = userId ? String(userId) : '';
  const isMongoUser = mongoose.Types.ObjectId.isValid(userIdStr) && /^[a-f0-9]{24}$/i.test(userIdStr);

  if (isDevUser || !isMongoUser) {
    // Dev users and Supabase UUID users get a local-only echo. The user's
    // library is sourced from the same store, so this keeps the UI
    // consistent without writing to a Mongo collection keyed off an
    // incompatible id.
    const mock = { _id: `local-master-${Date.now()}`, ...payload, userId };
    return sendSuccess(res, 'Script saved to your library.', 201, mock);
  }

  const doc = new Script({ userId, ...payload });
  await doc.save();
  sendSuccess(res, 'Script saved', 201, doc);
}));

/**
 * POST /api/ai/extract-quotes
 * Extract viral quotes from transcript
 */
router.post('/extract-quotes', auth, asyncHandler(async (req, res) => {
  const { transcript, engine, persona } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  const record = await withAiBudget(req, res, { prompt: transcript, out: 1500, taskType: 'extract-quotes' });
  if (!record) return;
  const result = await aiAgentWritingService.extractViralQuotes(transcript, engine, persona);
  record();
  sendSuccess(res, 'Viral quotes extracted', 200, result);
}));

/**
 * POST /api/ai/confidence/analyze
 * Analyze content confidence
 */
router.post('/confidence/analyze', auth, asyncHandler(async (req, res) => {
  const { contentId, content, context } = req.body;

  if (!contentId && !content) {
    return sendError(res, 'Content ID or content text is required', 400);
  }

  // IDOR guard: when analyzing by contentId, the caller must own that content.
  // (Analyzing raw `content` text the caller supplied is their own data.)
  if (contentId) {
    const owned = await guardOwnership(req, res, contentId);
    if (!owned) return;
  }

  const score = await analyzeContentConfidence(contentId, content, context || {});
  sendSuccess(res, 'Confidence analyzed', 200, score);
}));

/**
 * GET /api/ai/confidence/:contentId
 * Get confidence score for content
 */
router.get('/confidence/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  // IDOR guard: confidence scores (with their human-review reasons) are keyed
  // only by contentId, so verify the caller owns the content first.
  const owned = await guardOwnership(req, res, contentId);
  if (!owned) return;

  const score = await getContentConfidence(contentId);

  if (!score) {
    return sendError(res, 'Confidence score not found', 404);
  }

  sendSuccess(res, 'Confidence score retrieved', 200, score);
}));

/**
 * POST /api/ai/templates
 * Create or update AI template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const template = await createOrUpdateTemplate({
    ...req.body,
    createdBy: req.user._id
  });
  sendSuccess(res, 'Template saved', 201, template);
}));

/**
 * GET /api/ai/templates
 * Get AI templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  // IDOR guard: only members of the workspace may list its templates.
  const access = await verifyWorkspaceAccess(req.user._id, agencyWorkspaceId);
  if (!access.allowed) {
    return sendError(res, 'You do not have access to this workspace', 403);
  }

  const templates = await getTemplates(agencyWorkspaceId, clientWorkspaceId);
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * GET /api/ai/templates/:templateId
 * Get specific template
 */
router.get('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await AITemplate.findById(templateId).lean().catch(() => null);

  if (!template || !(await canAccessTemplate(template, req))) {
    return sendError(res, 'Template not found', 404);
  }

  sendSuccess(res, 'Template retrieved', 200, template);
}));

/**
 * POST /api/ai/templates/:templateId/generate
 * Generate content using template
 */
router.post('/templates/:templateId/generate', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { input, options } = req.body;

  if (!input) {
    return sendError(res, 'Input is required', 400);
  }

  // IDOR guard: don't run a billed generation on a template the caller can't access.
  const template = await AITemplate.findById(templateId).select('createdBy agencyWorkspaceId').lean().catch(() => null);
  if (!template || !(await canAccessTemplate(template, req))) {
    return sendError(res, 'Template not found', 404);
  }

  const record = await withAiBudget(req, res, { prompt: input, out: 2000, taskType: 'template-generate' });
  if (!record) return;
  const result = await generateContentWithTemplate(templateId, input, options || {});
  record();
  sendSuccess(res, 'Content generated', 200, result);
}));

/**
 * POST /api/ai/variants
 * Generate multiple variants
 */
router.post('/variants', auth, asyncHandler(async (req, res) => {
  const { content, count = 5, options } = req.body;

  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const userId = req.user?._id?.toString() || req.user?.id;
  const n = clampCount(count);
  const record = await withAiBudget(req, res, { prompt: content, out: 4000 * n, taskType: 'variants' });
  if (!record) return;
  const variants = await generateVariants(content, n, { ...(options || {}), userId });
  record();
  sendSuccess(res, 'Variants generated', 200, { variants });
}));

/**
 * POST /api/ai/improve
 * Improve specific section
 */
router.post('/improve', auth, asyncHandler(async (req, res) => {
  const { content, section, options } = req.body;

  if (!content || !section) {
    return sendError(res, 'Content and section are required', 400);
  }

  const userId = req.user?._id?.toString() || req.user?.id;
  const record = await withAiBudget(req, res, { prompt: content, out: 4000, taskType: 'improve' });
  if (!record) return;
  const result = await improveSection(content, section, { ...(options || {}), userId });
  record();
  sendSuccess(res, 'Section improved', 200, result);
}));

/**
 * POST /api/ai/rewrite
 * Rewrite for specific tone
 */
router.post('/rewrite', auth, asyncHandler(async (req, res) => {
  const { content, tone, options } = req.body;

  if (!content || !tone) {
    return sendError(res, 'Content and tone are required', 400);
  }

  const userId = req.user?._id?.toString() || req.user?.id;
  const record = await withAiBudget(req, res, { prompt: content, out: 4000, taskType: 'rewrite' });
  if (!record) return;
  const result = await rewriteForTone(content, tone, { ...(options || {}), userId });
  record();
  sendSuccess(res, 'Content rewritten', 200, result);
}));

/**
 * POST /api/ai/hooks
 * Generate hook variations
 */
router.post('/hooks', auth, asyncHandler(async (req, res) => {
  const { content, count = 5 } = req.body;

  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const userId = req.user?._id?.toString() || req.user?.id;
  const n = clampCount(count);
  const record = await withAiBudget(req, res, { prompt: content, out: 4000 * n, taskType: 'hooks' });
  if (!record) return;
  const variants = await generateHookVariations(content, n, { userId });
  record();
  sendSuccess(res, 'Hook variations generated', 200, { variants });
}));

module.exports = router;
module.exports.clampCount = clampCount;


