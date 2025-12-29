// Enhanced AI Routes
// Real-time confidence, template analytics, advanced editing, compliance

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { updateConfidenceRealTime, getConfidenceHistory, getConfidenceRecommendations, setConfidenceThresholds, batchAnalyzeConfidence } = require('../services/realTimeConfidenceService');
const { getTemplatePerformance, compareTemplateVersions, getTemplateSuggestions } = require('../services/templateAnalyticsService');
const { compareContentSideBySide, getEditSuggestions, bulkImproveSections } = require('../services/advancedEditingService');
const { checkContentCompliance, autoFixCompliance, getOptimizationSuggestions } = require('../services/automatedComplianceService');
const AITemplate = require('../models/AITemplate');
const router = express.Router();

/**
 * POST /api/ai/confidence/realtime
 * Update confidence in real-time
 */
router.post('/confidence/realtime', auth, asyncHandler(async (req, res) => {
  const { contentId, content, context } = req.body;

  if (!contentId || !content) {
    return sendError(res, 'Content ID and content are required', 400);
  }

  const result = await updateConfidenceRealTime(contentId, content, context || {});
  sendSuccess(res, 'Confidence updated', 200, result);
}));

/**
 * GET /api/ai/confidence/:contentId/history
 * Get confidence history
 */
router.get('/confidence/:contentId/history', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { limit = 10 } = req.query;

  const history = await getConfidenceHistory(contentId, parseInt(limit));
  sendSuccess(res, 'Confidence history retrieved', 200, { history });
}));

/**
 * GET /api/ai/confidence/:contentId/recommendations
 * Get confidence recommendations
 */
router.get('/confidence/:contentId/recommendations', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const recommendations = await getConfidenceRecommendations(contentId);
  sendSuccess(res, 'Recommendations retrieved', 200, { recommendations });
}));

/**
 * POST /api/ai/confidence/thresholds
 * Check confidence thresholds
 */
router.post('/confidence/thresholds', auth, asyncHandler(async (req, res) => {
  const { contentId, thresholds } = req.body;

  if (!contentId || !thresholds) {
    return sendError(res, 'Content ID and thresholds are required', 400);
  }

  const result = await setConfidenceThresholds(contentId, thresholds);
  sendSuccess(res, 'Thresholds checked', 200, result);
}));

/**
 * POST /api/ai/confidence/batch
 * Batch analyze confidence
 */
router.post('/confidence/batch', auth, asyncHandler(async (req, res) => {
  const { contentIds, context } = req.body;

  if (!contentIds || !Array.isArray(contentIds)) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  const result = await batchAnalyzeConfidence(contentIds, context || {});
  sendSuccess(res, 'Batch analysis completed', 200, result);
}));

/**
 * GET /api/ai/templates/:templateId/performance
 * Get template performance
 */
router.get('/templates/:templateId/performance', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { startDate, endDate } = req.query;

  const period = (startDate && endDate) ? {
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  } : null;

  const performance = await getTemplatePerformance(templateId, period);
  sendSuccess(res, 'Template performance retrieved', 200, performance);
}));

/**
 * GET /api/ai/templates/:templateId/compare
 * Compare template versions
 */
router.get('/templates/:templateId/compare', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const comparison = await compareTemplateVersions(templateId, parseInt(version1), parseInt(version2));
  sendSuccess(res, 'Versions compared', 200, comparison);
}));

/**
 * GET /api/ai/templates/suggestions
 * Get template suggestions
 */
router.get('/templates/suggestions', auth, asyncHandler(async (req, res) => {
  const { contentType, platform, brandStyle } = req.query;

  const suggestions = await getTemplateSuggestions(contentType, platform, brandStyle ? JSON.parse(brandStyle) : null);
  sendSuccess(res, 'Template suggestions retrieved', 200, { suggestions });
}));

/**
 * POST /api/ai/compare
 * Compare content side-by-side
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { original, edited } = req.body;

  if (!original || !edited) {
    return sendError(res, 'Original and edited content are required', 400);
  }

  const comparison = await compareContentSideBySide(original, edited);
  sendSuccess(res, 'Content compared', 200, comparison);
}));

/**
 * GET /api/ai/suggestions/:contentId
 * Get edit suggestions based on history
 */
router.get('/suggestions/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  // Would get edit history from database
  const editHistory = []; // Placeholder
  const suggestions = await getEditSuggestions(contentId, editHistory);
  sendSuccess(res, 'Edit suggestions retrieved', 200, { suggestions });
}));

/**
 * POST /api/ai/bulk-improve
 * Bulk improve sections
 */
router.post('/bulk-improve', auth, asyncHandler(async (req, res) => {
  const { content, sections, options } = req.body;

  if (!content || !sections || !Array.isArray(sections)) {
    return sendError(res, 'Content and sections array are required', 400);
  }

  const result = await bulkImproveSections(content, sections, options || {});
  sendSuccess(res, 'Sections improved', 200, result);
}));

/**
 * POST /api/ai/compliance/check
 * Check content compliance
 */
router.post('/compliance/check', auth, asyncHandler(async (req, res) => {
  const { content, templateId, options } = req.body;

  if (!content || !templateId) {
    return sendError(res, 'Content and template ID are required', 400);
  }

  const compliance = await checkContentCompliance(content, templateId, options || {});
  sendSuccess(res, 'Compliance checked', 200, compliance);
}));

/**
 * POST /api/ai/compliance/auto-fix
 * Auto-fix compliance issues
 */
router.post('/compliance/auto-fix', auth, asyncHandler(async (req, res) => {
  const { content, templateId, violations } = req.body;

  if (!content || !templateId || !violations) {
    return sendError(res, 'Content, template ID, and violations are required', 400);
  }

  const result = await autoFixCompliance(content, templateId, violations);
  sendSuccess(res, 'Compliance auto-fixed', 200, result);
}));

/**
 * GET /api/ai/optimization/:templateId
 * Get optimization suggestions
 */
router.get('/optimization/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { content } = req.query;

  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const suggestions = await getOptimizationSuggestions(content, templateId);
  sendSuccess(res, 'Optimization suggestions retrieved', 200, { suggestions });
}));

module.exports = router;


