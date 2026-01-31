// AI Content Routes
// Confidence scoring, AI templates, assisted editing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { analyzeContentConfidence, getContentConfidence } = require('../services/aiConfidenceService');
const { createOrUpdateTemplate, getTemplates, generateContentWithTemplate } = require('../services/aiTemplateService');
const { generateVariants, improveSection, rewriteForTone, generateHookVariations } = require('../services/assistedEditingService');
const aiAgentWritingService = require('../services/aiAgentWritingService');
const AITemplate = require('../models/AITemplate');
const Script = require('../models/Script');
const router = express.Router();

/**
 * POST /api/ai/generate-script
 * Generate role-based master script
 */
router.post('/generate-script', auth, asyncHandler(async (req, res) => {
  const { topic, tone, role } = req.body;

  if (!topic) {
    return sendError(res, 'Topic is required', 400);
  }

  const result = await aiAgentWritingService.generateMasterScript(topic, tone, role);
  sendSuccess(res, 'Master script generated', 200, result);
}));

/**
 * POST /api/ai/save-master-script
 * Save a generated master script (hook/body/cta) to user's scripts library
 */
router.post('/save-master-script', auth, asyncHandler(async (req, res) => {
  const { topic, tone, role, script } = req.body;
  const userId = req.user?._id || req.user?.id;
  const isDevUser = userId && String(userId).startsWith('dev-');

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

  if (isDevUser) {
    const mock = { _id: `dev-master-${Date.now()}`, ...payload, userId };
    return sendSuccess(res, 'Script saved locally. Sign in to sync to your library.', 201, mock);
  }

  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return sendError(res, 'Invalid user', 400);
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
  const { transcript } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  const result = await aiAgentWritingService.extractViralQuotes(transcript);
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

  const score = await analyzeContentConfidence(contentId, content, context || {});
  sendSuccess(res, 'Confidence analyzed', 200, score);
}));

/**
 * GET /api/ai/confidence/:contentId
 * Get confidence score for content
 */
router.get('/confidence/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
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

  const templates = await getTemplates(agencyWorkspaceId, clientWorkspaceId);
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * GET /api/ai/templates/:templateId
 * Get specific template
 */
router.get('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await AITemplate.findById(templateId).lean();

  if (!template) {
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

  const result = await generateContentWithTemplate(templateId, input, options || {});
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

  const variants = await generateVariants(content, count, options || {});
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

  const result = await improveSection(content, section, options || {});
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

  const result = await rewriteForTone(content, tone, options || {});
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

  const variants = await generateHookVariations(content, count);
  sendSuccess(res, 'Hook variations generated', 200, { variants });
}));

module.exports = router;


