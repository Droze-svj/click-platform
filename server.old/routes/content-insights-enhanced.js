// Enhanced Content Insights Routes
// Predictions, recommendations, heatmaps, comparison, quality, reports

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { predictContentPerformance, updatePredictionWithActual } = require('../services/contentPredictionService');
const { generateContentRecommendations, getContentRecommendations } = require('../services/contentRecommendationService');
const { generateEngagementHeatmap, getEngagementHeatmap } = require('../services/videoHeatmapService');
const { compareContent, analyzeABTest } = require('../services/contentComparisonService');
const { scoreContentQuality } = require('../services/contentQualityService');
const { generateContentInsightsReportExcel, generateContentInsightsReportPDF } = require('../services/contentInsightsReportService');
const router = express.Router();

/**
 * POST /api/posts/:postId/predict
 * Predict content performance
 */
router.post('/:postId/predict', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const prediction = await predictContentPerformance(postId);
  sendSuccess(res, 'Content performance predicted', 200, prediction);
}));

/**
 * POST /api/posts/:postId/predictions/update-actual
 * Update prediction with actual performance
 */
router.post('/:postId/predictions/update-actual', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const updated = await updatePredictionWithActual(postId);
  sendSuccess(res, 'Prediction updated with actual performance', 200, updated);
}));

/**
 * POST /api/workspaces/:workspaceId/content/recommendations/generate
 * Generate content recommendations
 */
router.post('/:workspaceId/content/recommendations/generate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const recommendations = await generateContentRecommendations(workspaceId, req.body);
  sendSuccess(res, 'Content recommendations generated', 200, { recommendations });
}));

/**
 * GET /api/workspaces/:workspaceId/content/recommendations
 * Get content recommendations
 */
router.get('/:workspaceId/content/recommendations', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const recommendations = await getContentRecommendations(workspaceId, req.query);
  sendSuccess(res, 'Content recommendations retrieved', 200, { recommendations });
}));

/**
 * POST /api/posts/:postId/video-heatmap
 * Generate engagement heatmap
 */
router.post('/:postId/video-heatmap', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const heatmap = await generateEngagementHeatmap(postId, req.body);
  sendSuccess(res, 'Engagement heatmap generated', 200, heatmap);
}));

/**
 * GET /api/posts/:postId/video-heatmap
 * Get engagement heatmap
 */
router.get('/:postId/video-heatmap', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const heatmap = await getEngagementHeatmap(postId);
  sendSuccess(res, 'Engagement heatmap retrieved', 200, heatmap);
}));

/**
 * POST /api/content/compare
 * Compare content performance
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { postIds, ...filters } = req.body;

  if (!postIds || !Array.isArray(postIds) || postIds.length < 2) {
    return sendError(res, 'At least 2 post IDs are required', 400);
  }

  const comparison = await compareContent(postIds, filters);
  sendSuccess(res, 'Content compared', 200, comparison);
}));

/**
 * POST /api/content/ab-test/analyze
 * Analyze A/B test
 */
router.post('/ab-test/analyze', auth, asyncHandler(async (req, res) => {
  const { testId, variantIds } = req.body;

  if (!testId || !variantIds || !Array.isArray(variantIds) || variantIds.length < 2) {
    return sendError(res, 'Test ID and at least 2 variant IDs are required', 400);
  }

  const analysis = await analyzeABTest(testId, variantIds);
  sendSuccess(res, 'A/B test analyzed', 200, analysis);
}));

/**
 * POST /api/posts/:postId/quality/score
 * Score content quality
 */
router.post('/:postId/quality/score', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const quality = await scoreContentQuality(postId);
  sendSuccess(res, 'Content quality scored', 200, quality);
}));

/**
 * GET /api/workspaces/:workspaceId/content-insights/export/excel
 * Export content insights report to Excel
 */
router.get('/:workspaceId/content-insights/export/excel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generateContentInsightsReportExcel(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=content-insights-${workspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/workspaces/:workspaceId/content-insights/export/pdf
 * Export content insights report to PDF
 */
router.get('/:workspaceId/content-insights/export/pdf', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generateContentInsightsReportPDF(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=content-insights-${workspaceId}.pdf`);
  res.send(buffer);
}));

module.exports = router;


