// Enhanced Revenue Routes
// Advanced attribution, forecasting, LTV, optimization, reports, goals

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { calculateAttribution, getAttributionComparison } = require('../services/advancedAttributionService');
const { forecastRevenue } = require('../services/revenueForecastingService');
const { updateCustomerLTV, getCustomerLTVAnalytics } = require('../services/customerLTVService');
const { getRevenueOptimizationRecommendations } = require('../services/revenueOptimizationService');
const { generateRevenueReportExcel, generateRevenueReportPDF } = require('../services/revenueReportService');
const { createRevenueGoal, updateRevenueGoalProgress, getRevenueGoals } = require('../services/revenueGoalService');
const router = express.Router();

/**
 * POST /api/conversions/:conversionId/attribution
 * Calculate attribution for conversion
 */
router.post('/:conversionId/attribution', auth, asyncHandler(async (req, res) => {
  const { conversionId } = req.params;
  const { model = 'last_touch' } = req.body;

  const attribution = await calculateAttribution(conversionId, model);
  sendSuccess(res, 'Attribution calculated', 200, attribution);
}));

/**
 * GET /api/conversions/:conversionId/attribution/compare
 * Compare different attribution models
 */
router.get('/:conversionId/attribution/compare', auth, asyncHandler(async (req, res) => {
  const { conversionId } = req.params;
  const comparison = await getAttributionComparison(conversionId);
  sendSuccess(res, 'Attribution comparison retrieved', 200, comparison);
}));

/**
 * POST /api/workspaces/:workspaceId/revenue/forecast
 * Forecast revenue
 */
router.post('/:workspaceId/revenue/forecast', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period, ...filters } = req.body;

  if (!period || !period.startDate || !period.endDate) {
    return sendError(res, 'Period with startDate and endDate is required', 400);
  }

  const forecast = await forecastRevenue(workspaceId, period, filters);
  sendSuccess(res, 'Revenue forecast generated', 200, forecast);
}));

/**
 * GET /api/workspaces/:workspaceId/customers/ltv
 * Get customer LTV analytics
 */
router.get('/:workspaceId/customers/ltv', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const analytics = await getCustomerLTVAnalytics(workspaceId, req.query);
  sendSuccess(res, 'Customer LTV analytics retrieved', 200, analytics);
}));

/**
 * GET /api/workspaces/:workspaceId/revenue/optimization
 * Get revenue optimization recommendations
 */
router.get('/:workspaceId/revenue/optimization', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const recommendations = await getRevenueOptimizationRecommendations(workspaceId, req.query);
  sendSuccess(res, 'Revenue optimization recommendations retrieved', 200, recommendations);
}));

/**
 * GET /api/workspaces/:workspaceId/revenue/export/excel
 * Export revenue report to Excel
 */
router.get('/:workspaceId/revenue/export/excel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generateRevenueReportExcel(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=revenue-report-${workspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/workspaces/:workspaceId/revenue/export/pdf
 * Export revenue report to PDF
 */
router.get('/:workspaceId/revenue/export/pdf', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const buffer = await generateRevenueReportPDF(workspaceId, req.query);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=revenue-report-${workspaceId}.pdf`);
  res.send(buffer);
}));

/**
 * POST /api/workspaces/:workspaceId/revenue-goals
 * Create revenue goal
 */
router.post('/:workspaceId/revenue-goals', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const goal = await createRevenueGoal(workspaceId, req.body);
  sendSuccess(res, 'Revenue goal created', 201, goal);
}));

/**
 * GET /api/workspaces/:workspaceId/revenue-goals
 * Get revenue goals
 */
router.get('/:workspaceId/revenue-goals', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const goals = await getRevenueGoals(workspaceId, req.query);
  sendSuccess(res, 'Revenue goals retrieved', 200, { goals });
}));

/**
 * POST /api/revenue-goals/:goalId/update-progress
 * Update revenue goal progress
 */
router.post('/:goalId/update-progress', auth, asyncHandler(async (req, res) => {
  const { goalId } = req.params;
  const goal = await updateRevenueGoalProgress(goalId);
  sendSuccess(res, 'Revenue goal progress updated', 200, goal);
}));

module.exports = router;


