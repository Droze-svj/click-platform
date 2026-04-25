// Enhanced Social Performance Metrics Routes
// Benchmarks, quality, attribution, reports, real-time

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  compareAgainstBenchmark,
  predictPerformance
} = require('../services/performanceBenchmarkService');
const {
  analyzeEngagementQuality,
  getTopQualityContent
} = require('../services/engagementQualityService');
const {
  calculateGrowthAttribution,
  forecastGrowth
} = require('../services/growthAttributionService');
const {
  generatePerformanceReportExcel,
  generatePerformanceReportPDF
} = require('../services/performanceReportService');
const {
  monitorPostEngagement,
  getRealTimeEngagementDashboard
} = require('../services/realTimeEngagementService');
const router = express.Router();

/**
 * GET /api/workspaces/:workspaceId/performance/benchmark
 * Compare performance against benchmark
 */
router.get('/:workspaceId/performance/benchmark', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { platform, industry, niche } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const comparison = await compareAgainstBenchmark(workspaceId, platform, {
    industry: industry || 'general',
    niche
  });

  sendSuccess(res, 'Benchmark comparison retrieved', 200, comparison);
}));

/**
 * POST /api/workspaces/:workspaceId/performance/predict
 * Predict future performance
 */
router.post('/:workspaceId/performance/predict', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { platform, days = 30 } = req.body;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const prediction = await predictPerformance(workspaceId, platform, days);
  sendSuccess(res, 'Performance prediction generated', 200, prediction);
}));

/**
 * POST /api/posts/:postId/engagement-quality
 * Analyze engagement quality
 */
router.post('/:postId/engagement-quality', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const quality = await analyzeEngagementQuality(postId);
  sendSuccess(res, 'Engagement quality analyzed', 200, quality);
}));

/**
 * GET /api/workspaces/:workspaceId/content/quality
 * Get top quality content
 */
router.get('/:workspaceId/content/quality', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const content = await getTopQualityContent(workspaceId, req.query);
  sendSuccess(res, 'Top quality content retrieved', 200, { content });
}));

/**
 * POST /api/audience-growth/:platform/attribution
 * Calculate growth attribution
 */
router.post('/:platform/attribution', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const attribution = await calculateGrowthAttribution(req.user._id, platform, {
    startDate,
    endDate
  });

  sendSuccess(res, 'Growth attribution calculated', 200, attribution);
}));

/**
 * POST /api/audience-growth/:platform/forecast
 * Forecast growth
 */
router.post('/:platform/forecast', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const { days = 30 } = req.body;

  const forecast = await forecastGrowth(req.user._id, platform, days);
  sendSuccess(res, 'Growth forecast generated', 200, forecast);
}));

/**
 * GET /api/workspaces/:workspaceId/performance/export/excel
 * Export performance report to Excel
 */
router.get('/:workspaceId/performance/export/excel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generatePerformanceReportExcel(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=performance-report-${workspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/workspaces/:workspaceId/performance/export/pdf
 * Export performance report to PDF
 */
router.get('/:workspaceId/performance/export/pdf', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generatePerformanceReportPDF(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=performance-report-${workspaceId}.pdf`);
  res.send(buffer);
}));

/**
 * POST /api/posts/:postId/engagement/monitor
 * Monitor post engagement
 */
router.post('/:postId/engagement/monitor', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const result = await monitorPostEngagement(postId, req.body);
  sendSuccess(res, 'Engagement monitored', 200, result);
}));

/**
 * GET /api/workspaces/:workspaceId/engagement/realtime
 * Get real-time engagement dashboard
 */
router.get('/:workspaceId/engagement/realtime', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const dashboard = await getRealTimeEngagementDashboard(workspaceId, req.query);
  sendSuccess(res, 'Real-time engagement dashboard retrieved', 200, dashboard);
}));

module.exports = router;


