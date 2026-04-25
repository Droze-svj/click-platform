// Enhanced Agency Business Routes
// Predictive analytics, alerts, benchmarking, cohort analysis, optimization

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { predictClientChurn, forecastRevenue, forecastSatisfaction } = require('../services/predictiveAnalyticsService');
const { checkBusinessAlerts, getActiveAlerts } = require('../services/businessAlertService');
const { getIndustryBenchmarks, compareAgainstBenchmarks } = require('../services/industryBenchmarkService');
const { analyzeCohorts, generateRetentionCurve } = require('../services/cohortAnalysisService');
const { generateOptimizationRecommendations } = require('../services/businessOptimizationService');
const { getAgencyBusinessDashboard } = require('../services/agencyBusinessDashboardService');
const router = express.Router();

/**
 * POST /api/agencies/:agencyWorkspaceId/clients/:clientWorkspaceId/churn-prediction
 * Predict client churn
 */
router.post('/:agencyWorkspaceId/clients/:clientWorkspaceId/churn-prediction', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.params;
  const prediction = await predictClientChurn(agencyWorkspaceId, clientWorkspaceId);
  sendSuccess(res, 'Churn prediction generated', 200, prediction);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/revenue/forecast
 * Forecast revenue
 */
router.post('/:agencyWorkspaceId/revenue/forecast', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { months = 6 } = req.body;
  const forecast = await forecastRevenue(agencyWorkspaceId, months);
  sendSuccess(res, 'Revenue forecast generated', 200, forecast);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/satisfaction/forecast
 * Forecast satisfaction
 */
router.post('/:agencyWorkspaceId/satisfaction/forecast', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { months = 3 } = req.body;
  const forecast = await forecastSatisfaction(agencyWorkspaceId, months);
  sendSuccess(res, 'Satisfaction forecast generated', 200, forecast);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/business-alerts/check
 * Check and create business alerts
 */
router.post('/:agencyWorkspaceId/business-alerts/check', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const alerts = await checkBusinessAlerts(agencyWorkspaceId);
  sendSuccess(res, 'Business alerts checked', 200, { alerts });
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/business-alerts
 * Get active business alerts
 */
router.get('/:agencyWorkspaceId/business-alerts', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const alerts = await getActiveAlerts(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Active alerts retrieved', 200, { alerts });
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/benchmarks
 * Get industry benchmarks
 */
router.get('/:agencyWorkspaceId/benchmarks', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { getIndustryBenchmarks } = require('../services/industryBenchmarkService');
  const benchmarks = getIndustryBenchmarks();
  sendSuccess(res, 'Industry benchmarks retrieved', 200, benchmarks);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/benchmarks/compare
 * Compare metrics against benchmarks
 */
router.get('/:agencyWorkspaceId/benchmarks/compare', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  
  // Get current metrics
  const { getAgencyBusinessDashboard } = require('../services/agencyBusinessDashboardService');
  const dashboard = await getAgencyBusinessDashboard(agencyWorkspaceId, req.query);
  
  const comparison = await compareAgainstBenchmarks(agencyWorkspaceId, {
    retention: dashboard.retention,
    satisfaction: dashboard.satisfaction,
    cpa: dashboard.cpa,
    efficiency: dashboard.efficiency
  });
  
  sendSuccess(res, 'Benchmark comparison retrieved', 200, comparison);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/cohorts
 * Analyze client cohorts
 */
router.get('/:agencyWorkspaceId/cohorts', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const analysis = await analyzeCohorts(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Cohort analysis retrieved', 200, analysis);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/retention-curve
 * Generate retention curve
 */
router.get('/:agencyWorkspaceId/retention-curve', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { cohortKey } = req.query;
  const curve = await generateRetentionCurve(agencyWorkspaceId, cohortKey);
  sendSuccess(res, 'Retention curve generated', 200, curve);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/optimization/recommendations
 * Get optimization recommendations
 */
router.get('/:agencyWorkspaceId/optimization/recommendations', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const recommendations = await generateOptimizationRecommendations(agencyWorkspaceId);
  sendSuccess(res, 'Optimization recommendations retrieved', 200, recommendations);
}));

module.exports = router;


