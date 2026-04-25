// Report Builder Routes
// Custom report builder, templates, multi-client rollup, AI summaries

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { createOrUpdateTemplate, getTemplates, generateReport } = require('../services/reportBuilderService');
const { generateMultiClientRollup, getRollup } = require('../services/multiClientRollupService');
const { generateReportSummary, generateRollupSummary } = require('../services/aiReportSummaryService');
const GeneratedReport = require('../models/GeneratedReport');
const ReportTemplate = require('../models/ReportTemplate');
const router = express.Router();

/**
 * POST /api/reports/templates
 * Create or update report template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const template = await createOrUpdateTemplate({
    ...req.body,
    createdBy: req.user._id
  });
  sendSuccess(res, 'Template saved', 201, template);
}));

/**
 * GET /api/reports/templates
 * Get templates
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
 * GET /api/reports/templates/:templateId
 * Get specific template
 */
router.get('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await ReportTemplate.findById(templateId).lean();

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  sendSuccess(res, 'Template retrieved', 200, template);
}));

/**
 * DELETE /api/reports/templates/:templateId
 * Delete template
 */
router.delete('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  await ReportTemplate.findByIdAndDelete(templateId);
  sendSuccess(res, 'Template deleted', 200);
}));

/**
 * POST /api/reports/generate
 * Generate report from template
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const { templateId, period, clientWorkspaceId, agencyWorkspaceId } = req.body;

  if (!templateId || !period || !clientWorkspaceId || !agencyWorkspaceId) {
    return sendError(res, 'Template ID, period, client workspace ID, and agency workspace ID are required', 400);
  }

  const report = await generateReport(templateId, period, clientWorkspaceId, agencyWorkspaceId, req.user._id);
  sendSuccess(res, 'Report generated', 201, report);
}));

/**
 * GET /api/reports/:reportId
 * Get generated report
 */
router.get('/:reportId', auth, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const report = await GeneratedReport.findById(reportId)
    .populate('templateId')
    .lean();

  if (!report) {
    return sendError(res, 'Report not found', 404);
  }

  sendSuccess(res, 'Report retrieved', 200, report);
}));

/**
 * POST /api/reports/:reportId/summary
 * Generate AI summary for report
 */
router.post('/:reportId/summary', auth, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const report = await GeneratedReport.findById(reportId)
    .populate('templateId')
    .lean();

  if (!report) {
    return sendError(res, 'Report not found', 404);
  }

  const summary = await generateReportSummary(report, report.templateId?.aiSummary || {});

  // Update report with summary
  await GeneratedReport.findByIdAndUpdate(reportId, {
    aiSummary: summary
  });

  sendSuccess(res, 'Summary generated', 200, summary);
}));

/**
 * GET /api/agencies/:agencyWorkspaceId/rollup
 * Get multi-client rollup
 */
router.get('/agencies/:agencyWorkspaceId/rollup', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { startDate, endDate } = req.query;

  const period = (startDate && endDate) ? {
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  } : null;

  const rollup = await getRollup(agencyWorkspaceId, period);
  sendSuccess(res, 'Rollup retrieved', 200, rollup);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/rollup/generate
 * Generate multi-client rollup
 */
router.post('/agencies/:agencyWorkspaceId/rollup/generate', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const period = {
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  };

  const rollup = await generateMultiClientRollup(agencyWorkspaceId, period);
  sendSuccess(res, 'Rollup generated', 201, rollup);
}));

/**
 * POST /api/agencies/:agencyWorkspaceId/rollup/summary
 * Generate AI summary for rollup
 */
router.post('/agencies/:agencyWorkspaceId/rollup/summary', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { tone = 'professional' } = req.body;

  const rollup = await getRollup(agencyWorkspaceId);
  if (!rollup) {
    return sendError(res, 'Rollup not found. Generate rollup first.', 404);
  }

  const summary = await generateRollupSummary(rollup, tone);
  sendSuccess(res, 'Rollup summary generated', 200, summary);
}));

module.exports = router;


