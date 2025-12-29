// Agency Business Metrics Routes
// Retention, satisfaction, CPA/CLTV, efficiency

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { upsertClientRetention, recordChurn, calculateChurnRisk, getRetentionMetrics } = require('../services/clientRetentionService');
const { createSatisfactionSurvey, submitSatisfactionResponse, calculateNPS, getSatisfactionMetrics } = require('../services/clientSatisfactionService');
const { upsertCampaignCPA, getCampaignCPAMetrics } = require('../services/campaignCPAService');
const { calculateInternalEfficiency, getInternalEfficiencyMetrics } = require('../services/internalEfficiencyService');
const { getAgencyBusinessDashboard } = require('../services/agencyBusinessDashboardService');
const { generateAgencyBusinessReportExcel, generateAgencyBusinessReportPDF } = require('../services/agencyBusinessReportService');
const router = express.Router();

/**
 * GET /api/agencies/:agencyWorkspaceId/business/dashboard
 * Get agency business dashboard
 */
router.get('/:agencyWorkspaceId/business/dashboard', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const dashboard = await getAgencyBusinessDashboard(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Agency business dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/clients/:clientWorkspaceId/retention
 * Create or update client retention
 */
router.post('/:agencyWorkspaceId/clients/:clientWorkspaceId/retention', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.params;
  const retention = await upsertClientRetention(agencyWorkspaceId, clientWorkspaceId, req.body);
  sendSuccess(res, 'Client retention updated', 200, retention);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/clients/:clientWorkspaceId/churn
 * Record client churn
 */
router.post('/:agencyWorkspaceId/clients/:clientWorkspaceId/churn', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.params;
  const retention = await recordChurn(agencyWorkspaceId, clientWorkspaceId, req.body);
  sendSuccess(res, 'Churn recorded', 200, retention);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/clients/:clientWorkspaceId/churn-risk
 * Calculate churn risk
 */
router.post('/:agencyWorkspaceId/clients/:clientWorkspaceId/churn-risk', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.params;
  const risk = await calculateChurnRisk(agencyWorkspaceId, clientWorkspaceId);
  sendSuccess(res, 'Churn risk calculated', 200, risk);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/retention/metrics
 * Get retention metrics
 */
router.get('/:agencyWorkspaceId/retention/metrics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const metrics = await getRetentionMetrics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Retention metrics retrieved', 200, metrics);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/clients/:clientWorkspaceId/satisfaction/survey
 * Create satisfaction survey
 */
router.post('/:agencyWorkspaceId/clients/:clientWorkspaceId/satisfaction/survey', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.params;
  const survey = await createSatisfactionSurvey(agencyWorkspaceId, clientWorkspaceId, req.body);
  sendSuccess(res, 'Satisfaction survey created', 201, survey);
}));

/**
 * POST /api/satisfaction/:surveyId/response
 * Submit satisfaction response
 */
router.post('/:surveyId/response', auth, asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const survey = await submitSatisfactionResponse(surveyId, req.body);
  sendSuccess(res, 'Satisfaction response submitted', 200, survey);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/satisfaction/nps
 * Calculate NPS
 */
router.get('/:agencyWorkspaceId/satisfaction/nps', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const nps = await calculateNPS(agencyWorkspaceId, req.query);
  sendSuccess(res, 'NPS calculated', 200, nps);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/satisfaction/metrics
 * Get satisfaction metrics
 */
router.get('/:agencyWorkspaceId/satisfaction/metrics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const metrics = await getSatisfactionMetrics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Satisfaction metrics retrieved', 200, metrics);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/campaigns/cpa
 * Create or update campaign CPA
 */
router.post('/:agencyWorkspaceId/campaigns/cpa', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const cpa = await upsertCampaignCPA(agencyWorkspaceId, req.body);
  sendSuccess(res, 'Campaign CPA updated', 200, cpa);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/campaigns/cpa/metrics
 * Get campaign CPA metrics
 */
router.get('/:agencyWorkspaceId/campaigns/cpa/metrics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const metrics = await getCampaignCPAMetrics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Campaign CPA metrics retrieved', 200, metrics);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/efficiency/calculate
 * Calculate internal efficiency
 */
router.post('/:agencyWorkspaceId/efficiency/calculate', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { period } = req.body;

  if (!period || !period.startDate || !period.endDate) {
    return sendError(res, 'Period with startDate and endDate is required', 400);
  }

  const efficiency = await calculateInternalEfficiency(agencyWorkspaceId, period);
  sendSuccess(res, 'Internal efficiency calculated', 200, efficiency);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/efficiency/metrics
 * Get internal efficiency metrics
 */
router.get('/:agencyWorkspaceId/efficiency/metrics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const metrics = await getInternalEfficiencyMetrics(agencyWorkspaceId, req.query);
  sendSuccess(res, 'Internal efficiency metrics retrieved', 200, metrics);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/business/report/excel
 * Export business report to Excel
 */
router.get('/:agencyWorkspaceId/business/report/excel', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const buffer = await generateAgencyBusinessReportExcel(agencyWorkspaceId, req.query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=agency-business-report-${agencyWorkspaceId}.xlsx`);
  res.send(buffer);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/business/report/pdf
 * Export business report to PDF
 */
router.get('/:agencyWorkspaceId/business/report/pdf', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const buffer = await generateAgencyBusinessReportPDF(agencyWorkspaceId, req.query);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=agency-business-report-${agencyWorkspaceId}.pdf`);
  res.send(buffer);
}));

module.exports = router;

