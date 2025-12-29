// Client Health Routes
// Brand awareness, benchmarking, health scores, key wins, sentiment

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { calculateBrandAwareness, getBrandAwarenessTrends } = require('../services/brandAwarenessService');
const { updateCompetitorBenchmark, getBenchmarkComparison } = require('../services/competitorBenchmarkService');
const { calculateClientHealthScore, getClientHealthDashboard } = require('../services/clientHealthService');
const { createKeyWin, getKeyWins, getKeyWinsSummary } = require('../services/keyWinService');
const { analyzeCommentSentiment, getCommentSentimentTrends } = require('../services/commentSentimentService');
const { generateClientHealthReportExcel, generateClientHealthReportPDF } = require('../services/clientHealthReportService');
const router = express.Router();

/**
 * POST /api/workspaces/:workspaceId/brand-awareness/calculate
 * Calculate brand awareness
 */
router.post('/:workspaceId/brand-awareness/calculate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { platform, period } = req.body;

  if (!platform || !period || !period.startDate || !period.endDate) {
    return sendError(res, 'Platform and period with startDate and endDate are required', 400);
  }

  const awareness = await calculateBrandAwareness(workspaceId, platform, period);
  sendSuccess(res, 'Brand awareness calculated', 200, awareness);
}));

/**
 * GET /api/workspaces/:workspaceId/brand-awareness/trends
 * Get brand awareness trends
 */
router.get('/:workspaceId/brand-awareness/trends', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const trends = await getBrandAwarenessTrends(workspaceId, req.query);
  sendSuccess(res, 'Brand awareness trends retrieved', 200, trends);
}));

/**
 * POST /api/workspaces/:workspaceId/competitor-benchmark/update
 * Update competitor benchmark
 */
router.post('/:workspaceId/competitor-benchmark/update', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { platform, period, competitorData } = req.body;

  if (!platform || !period || !period.startDate || !period.endDate) {
    return sendError(res, 'Platform and period with startDate and endDate are required', 400);
  }

  const benchmark = await updateCompetitorBenchmark(workspaceId, platform, period, competitorData);
  sendSuccess(res, 'Competitor benchmark updated', 200, benchmark);
}));

/**
 * GET /api/workspaces/:workspaceId/competitor-benchmark/compare
 * Get benchmark comparison
 */
router.get('/:workspaceId/competitor-benchmark/compare', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { platform, period } = req.query;

  if (!platform || !period) {
    return sendError(res, 'Platform and period are required', 400);
  }

  const comparison = await getBenchmarkComparison(workspaceId, platform, JSON.parse(period));
  sendSuccess(res, 'Benchmark comparison retrieved', 200, comparison);
}));

/**
 * POST /api/clients/:clientWorkspaceId/health-score/calculate
 * Calculate client health score
 */
router.post('/:clientWorkspaceId/health-score/calculate', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, period } = req.body;

  if (!agencyWorkspaceId || !period || !period.startDate || !period.endDate) {
    return sendError(res, 'Agency workspace ID and period with startDate and endDate are required', 400);
  }

  const healthScore = await calculateClientHealthScore(clientWorkspaceId, agencyWorkspaceId, period);
  sendSuccess(res, 'Client health score calculated', 200, healthScore);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health-score/dashboard
 * Get client health dashboard
 */
router.get('/:clientWorkspaceId/health-score/dashboard', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const dashboard = await getClientHealthDashboard(clientWorkspaceId, req.query);
  sendSuccess(res, 'Client health dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/clients/:clientWorkspaceId/key-wins
 * Create key win
 */
router.post('/:clientWorkspaceId/key-wins', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { workspaceId, agencyWorkspaceId, ...winData } = req.body;

  if (!workspaceId || !agencyWorkspaceId) {
    return sendError(res, 'Workspace ID and agency workspace ID are required', 400);
  }

  const keyWin = await createKeyWin(workspaceId, clientWorkspaceId, agencyWorkspaceId, winData);
  sendSuccess(res, 'Key win created', 201, keyWin);
}));

/**
 * GET /api/clients/:clientWorkspaceId/key-wins
 * Get key wins
 */
router.get('/:clientWorkspaceId/key-wins', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const wins = await getKeyWins(clientWorkspaceId, req.query);
  sendSuccess(res, 'Key wins retrieved', 200, { wins });
}));

/**
 * GET /api/clients/:clientWorkspaceId/key-wins/summary
 * Get key wins summary
 */
router.get('/:clientWorkspaceId/key-wins/summary', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const summary = await getKeyWinsSummary(clientWorkspaceId, req.query);
  sendSuccess(res, 'Key wins summary retrieved', 200, summary);
}));

/**
 * POST /api/posts/:postId/comments/sentiment
 * Analyze comment sentiment
 */
router.post('/:postId/comments/sentiment', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const sentiment = await analyzeCommentSentiment(postId, req.body);
  sendSuccess(res, 'Comment sentiment analyzed', 200, sentiment);
}));

/**
 * GET /api/workspaces/:workspaceId/comments/sentiment/trends
 * Get comment sentiment trends
 */
router.get('/:workspaceId/comments/sentiment/trends', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const trends = await getCommentSentimentTrends(workspaceId, req.query);
  sendSuccess(res, 'Comment sentiment trends retrieved', 200, trends);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health-report/export/excel
 * Export client health report to Excel
 */
router.get('/:clientWorkspaceId/health-report/export/excel', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, ...filters } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const buffer = await generateClientHealthReportExcel(clientWorkspaceId, agencyWorkspaceId, filters);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=client-health-report-${clientWorkspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health-report/export/pdf
 * Export client health report to PDF
 */
router.get('/:clientWorkspaceId/health-report/export/pdf', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId, ...filters } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const buffer = await generateClientHealthReportPDF(clientWorkspaceId, agencyWorkspaceId, filters);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=client-health-report-${clientWorkspaceId}.pdf`);
  res.send(buffer);
}));

module.exports = router;


