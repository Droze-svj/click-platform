// Content Curation Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  scoreContentForCuration,
  discoverContentForCuration,
  autoCurateContent,
  getCurationInsights,
  batchCurateContent,
  getCuratedFeed,
  detectSimilarContent,
  assessContentFreshness,
  analyzeContentGaps,
  optimizeCurationSchedule,
  predictCurationPerformance,
  clusterContentForCuration
} = require('../services/contentCurationService');
const {
  createCurationRule,
  getUserRules,
  executeCurationRule,
  executeAllActiveRules,
  updateCurationRule,
  deleteCurationRule
} = require('../services/curationRuleService');
const {
  createCurationTemplate,
  getUserTemplates,
  getPublicTemplates,
  useTemplateForCuration,
  updateCurationTemplate,
  deleteCurationTemplate,
  duplicateTemplate
} = require('../services/curationTemplateService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * POST /api/curation/score/:contentId
 * Score content for curation
 */
router.post('/score/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const options = req.body;

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const score = await scoreContentForCuration(req.user._id, content, options);
  sendSuccess(res, 'Content scored', 200, score);
}));

/**
 * POST /api/curation/discover
 * Discover content for curation
 */
router.post('/discover', auth, asyncHandler(async (req, res) => {
  const discovery = await discoverContentForCuration(req.user._id, req.body);
  sendSuccess(res, 'Content discovered', 200, discovery);
}));

/**
 * POST /api/curation/auto-curate
 * Auto-curate content based on rules
 */
router.post('/auto-curate', auth, asyncHandler(async (req, res) => {
  const result = await autoCurateContent(req.user._id, req.body);
  sendSuccess(res, 'Content curated', 200, result);
}));

/**
 * GET /api/curation/insights
 * Get curation insights
 */
router.get('/insights', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const insights = await getCurationInsights(req.user._id, parseInt(period));
  sendSuccess(res, 'Insights retrieved', 200, insights);
}));

/**
 * POST /api/curation/batch
 * Batch curate content
 */
router.post('/batch', auth, asyncHandler(async (req, res) => {
  const { contentIds, ...options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  const result = await batchCurateContent(req.user._id, contentIds, options);
  sendSuccess(res, 'Content batch curated', 200, result);
}));

/**
 * GET /api/curation/feed
 * Get curated content feed
 */
router.get('/feed', auth, asyncHandler(async (req, res) => {
  const {
    limit = 20,
    minScore = 70,
    platforms = null,
    contentTypes = null,
    sortBy = 'score'
  } = req.query;

  const platformsArray = platforms ? platforms.split(',') : null;
  const contentTypesArray = contentTypes ? contentTypes.split(',') : null;

  const feed = await getCuratedFeed(req.user._id, {
    limit: parseInt(limit),
    minScore: parseInt(minScore),
    platforms: platformsArray,
    contentTypes: contentTypesArray,
    sortBy
  });

  sendSuccess(res, 'Feed retrieved', 200, feed);
}));

/**
 * POST /api/curation/rules
 * Create curation rule
 */
router.post('/rules', auth, asyncHandler(async (req, res) => {
  const rule = await createCurationRule(req.user._id, req.body);
  sendSuccess(res, 'Rule created', 201, rule);
}));

/**
 * GET /api/curation/rules
 * Get user's curation rules
 */
router.get('/rules', auth, asyncHandler(async (req, res) => {
  const { activeOnly = false } = req.query;
  const rules = await getUserRules(req.user._id, activeOnly === 'true');
  sendSuccess(res, 'Rules retrieved', 200, { rules });
}));

/**
 * POST /api/curation/rules/:id/execute
 * Execute curation rule
 */
router.post('/rules/:id/execute', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await executeCurationRule(id, req.user._id);
  sendSuccess(res, 'Rule executed', 200, result);
}));

/**
 * POST /api/curation/rules/execute-all
 * Execute all active rules
 */
router.post('/rules/execute-all', auth, asyncHandler(async (req, res) => {
  const result = await executeAllActiveRules(req.user._id);
  sendSuccess(res, 'Rules executed', 200, result);
}));

/**
 * PUT /api/curation/rules/:id
 * Update curation rule
 */
router.put('/rules/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rule = await updateCurationRule(id, req.user._id, req.body);
  sendSuccess(res, 'Rule updated', 200, rule);
}));

/**
 * DELETE /api/curation/rules/:id
 * Delete curation rule
 */
router.delete('/rules/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteCurationRule(id, req.user._id);
  sendSuccess(res, 'Rule deleted', 200);
}));

/**
 * GET /api/curation/similar/:contentId
 * Detect similar content
 */
router.get('/similar/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { threshold = 0.7 } = req.query;

  const result = await detectSimilarContent(req.user._id, contentId, parseFloat(threshold));
  sendSuccess(res, 'Similar content detected', 200, result);
}));

/**
 * GET /api/curation/freshness/:contentId
 * Assess content freshness
 */
router.get('/freshness/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const result = await assessContentFreshness(req.user._id, contentId);
  sendSuccess(res, 'Freshness assessed', 200, result);
}));

/**
 * GET /api/curation/gaps
 * Analyze content gaps
 */
router.get('/gaps', auth, asyncHandler(async (req, res) => {
  const { period = 90 } = req.query;

  const gaps = await analyzeContentGaps(req.user._id, parseInt(period));
  sendSuccess(res, 'Gaps analyzed', 200, gaps);
}));

/**
 * POST /api/curation/optimize-schedule
 * Optimize curation schedule
 */
router.post('/optimize-schedule', auth, asyncHandler(async (req, res) => {
  const { contentIds, ...options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  const schedule = await optimizeCurationSchedule(req.user._id, contentIds, options);
  sendSuccess(res, 'Schedule optimized', 200, schedule);
}));

/**
 * GET /api/curation/predict/:contentId
 * Predict content performance for curation
 */
router.get('/predict/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const prediction = await predictCurationPerformance(req.user._id, contentId);
  sendSuccess(res, 'Performance predicted', 200, prediction);
}));

/**
 * POST /api/curation/cluster
 * Cluster content for batch curation
 */
router.post('/cluster', auth, asyncHandler(async (req, res) => {
  const { contentIds, ...options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  const clusters = await clusterContentForCuration(req.user._id, contentIds, options);
  sendSuccess(res, 'Content clustered', 200, clusters);
}));

/**
 * POST /api/curation/templates
 * Create curation template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const template = await createCurationTemplate(req.user._id, req.body);
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * GET /api/curation/templates
 * Get user's templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const { includePublic = false } = req.query;
  const templates = await getUserTemplates(req.user._id, includePublic === 'true');
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * GET /api/curation/templates/public
 * Get public templates
 */
router.get('/templates/public', auth, asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;
  const templates = await getPublicTemplates(parseInt(limit));
  sendSuccess(res, 'Public templates retrieved', 200, { templates });
}));

/**
 * POST /api/curation/templates/:id/use
 * Use template for curation
 */
router.post('/templates/:id/use', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await useTemplateForCuration(id, req.user._id);
  sendSuccess(res, 'Template used', 200, result);
}));

/**
 * PUT /api/curation/templates/:id
 * Update template
 */
router.put('/templates/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await updateCurationTemplate(id, req.user._id, req.body);
  sendSuccess(res, 'Template updated', 200, template);
}));

/**
 * DELETE /api/curation/templates/:id
 * Delete template
 */
router.delete('/templates/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteCurationTemplate(id, req.user._id);
  sendSuccess(res, 'Template deleted', 200);
}));

/**
 * POST /api/curation/templates/:id/duplicate
 * Duplicate template
 */
router.post('/templates/:id/duplicate', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const template = await duplicateTemplate(id, req.user._id, name);
  sendSuccess(res, 'Template duplicated', 201, template);
}));

module.exports = router;

