// AI Content Routes
// Confidence scoring, AI templates, assisted editing

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { analyzeContentConfidence, getContentConfidence } = require('../services/aiConfidenceService');
const { createOrUpdateTemplate, getTemplates, generateContentWithTemplate } = require('../services/aiTemplateService');
const { generateVariants, improveSection, rewriteForTone, generateHookVariations } = require('../services/assistedEditingService');
const AITemplate = require('../models/AITemplate');
const router = express.Router();

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


