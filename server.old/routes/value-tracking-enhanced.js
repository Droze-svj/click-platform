// Enhanced Value Tracking Routes
// Reports, forecasting, automated tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  generateExcelReport,
  generatePDFReport
} = require('../services/valueReportService');
const {
  recalculateValueTracking,
  autoCalculateMonthlyTracking
} = require('../services/automatedValueTrackingService');
const {
  forecastValue
} = require('../services/valueForecastingService');
const {
  getCustomizableKPIDashboard,
  exportKPIDashboardToExcel,
  getClientKPIDashboard
} = require('../services/kpiDashboardEnhancedService');
const {
  checkTierUsageAndAlert,
  recommendTierChange,
  processTierUpgrade,
  processTierDowngrade
} = require('../services/tierManagementService');
const router = express.Router();

/**
 * GET /api/clients/:clientWorkspaceId/value-tracking/export/excel
 * Export value tracking to Excel
 */
router.get('/:clientWorkspaceId/value-tracking/export/excel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const buffer = await generateExcelReport(clientWorkspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=value-tracking-${clientWorkspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/clients/:clientWorkspaceId/value-tracking/export/pdf
 * Export value tracking to PDF
 */
router.get('/:clientWorkspaceId/value-tracking/export/pdf', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const buffer = await generatePDFReport(clientWorkspaceId, req.query);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=value-tracking-${clientWorkspaceId}.pdf`);
  res.send(buffer);
}));

/**
 * POST /api/clients/:clientWorkspaceId/value-tracking/recalculate
 * Recalculate value tracking
 */
router.post('/:clientWorkspaceId/value-tracking/recalculate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const tracking = await recalculateValueTracking(clientWorkspaceId, { startDate, endDate });
  sendSuccess(res, 'Value tracking recalculated', 200, tracking);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/value-tracking/auto-calculate
 * Auto-calculate monthly tracking for all clients
 */
router.post('/:agencyWorkspaceId/value-tracking/auto-calculate', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const result = await autoCalculateMonthlyTracking(agencyWorkspaceId);
  sendSuccess(res, 'Monthly tracking calculated', 200, result);
}));

/**
 * POST /api/clients/:clientWorkspaceId/value-tracking/forecast
 * Forecast future value
 */
router.post('/:clientWorkspaceId/value-tracking/forecast', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { startDate, endDate, ...options } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const forecast = await forecastValue(clientWorkspaceId, { startDate, endDate }, options);
  sendSuccess(res, 'Value forecast generated', 200, forecast);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/kpi-dashboard/custom
 * Get customizable KPI dashboard
 */
router.get('/:agencyWorkspaceId/kpi-dashboard/custom', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const dashboard = await getCustomizableKPIDashboard(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Custom KPI dashboard retrieved', 200, dashboard);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/kpi-dashboard/export/excel
 * Export KPI dashboard to Excel
 */
router.get('/:agencyWorkspaceId/kpi-dashboard/export/excel', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const buffer = await exportKPIDashboardToExcel(agencyWorkspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=kpi-dashboard-${agencyWorkspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/clients/:clientWorkspaceId/kpi-dashboard
 * Get client-specific KPI dashboard
 */
router.get('/:clientWorkspaceId/kpi-dashboard', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const dashboard = await getClientKPIDashboard(clientWorkspaceId, req.query);
  sendSuccess(res, 'Client KPI dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/clients/:clientWorkspaceId/service-tier/check-usage
 * Check tier usage and get alerts
 */
router.post('/:clientWorkspaceId/service-tier/check-usage', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const alerts = await checkTierUsageAndAlert(clientWorkspaceId);
  sendSuccess(res, 'Tier usage checked', 200, { alerts });
}));

/**
 * GET /api/clients/:clientWorkspaceId/service-tier/recommendation
 * Get tier change recommendation
 */
router.get('/:clientWorkspaceId/service-tier/recommendation', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const recommendation = await recommendTierChange(clientWorkspaceId);
  sendSuccess(res, 'Tier recommendation retrieved', 200, recommendation);
}));

/**
 * POST /api/clients/:clientWorkspaceId/service-tier/upgrade
 * Upgrade tier
 */
router.post('/:clientWorkspaceId/service-tier/upgrade', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { tierId } = req.body;

  if (!tierId) {
    return sendError(res, 'Tier ID is required', 400);
  }

  const assignment = await processTierUpgrade(clientWorkspaceId, tierId, req.user._id);
  sendSuccess(res, 'Tier upgraded', 200, assignment);
}));

/**
 * POST /api/clients/:clientWorkspaceId/service-tier/downgrade
 * Downgrade tier
 */
router.post('/:clientWorkspaceId/service-tier/downgrade', auth, requireWorkspaceAccess('canManageWorkflows'), asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { tierId } = req.body;

  if (!tierId) {
    return sendError(res, 'Tier ID is required', 400);
  }

  const assignment = await processTierDowngrade(clientWorkspaceId, tierId, req.user._id);
  sendSuccess(res, 'Tier downgraded', 200, assignment);
}));

module.exports = router;


