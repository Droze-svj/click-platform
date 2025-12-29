// Enhanced Reports Routes
// Report templates, scheduled delivery, comparisons

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { generateClientReport } = require('../services/reportGenerationService');
const { generateComparisonReport } = require('../services/reportComparisonService');
const ReportTemplate = require('../models/ReportTemplate');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/reports/templates
 * Create report template
 */
router.post('/:agencyWorkspaceId/reports/templates', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const template = new ReportTemplate({
    ...req.body,
    agencyWorkspaceId,
    createdBy: req.user._id
  });

  // If setting as default, unset other defaults
  if (template.isDefault) {
    await ReportTemplate.updateMany(
      { agencyWorkspaceId, isDefault: true },
      { isDefault: false }
    );
  }

  await template.save();
  sendSuccess(res, 'Report template created', 201, template);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/reports/templates
 * Get report templates
 */
router.get('/:agencyWorkspaceId/reports/templates', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const templates = await ReportTemplate.find({ agencyWorkspaceId })
    .populate('createdBy', 'name email')
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/reports/templates/:templateId
 * Get report template
 */
router.get('/:agencyWorkspaceId/reports/templates/:templateId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await ReportTemplate.findById(templateId).lean();

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  sendSuccess(res, 'Template retrieved', 200, template);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/reports/generate-from-template
 * Generate report from template
 */
router.post('/:agencyWorkspaceId/reports/generate-from-template', auth, requireWorkspaceAccess('canExportData'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    templateId,
    clientWorkspaceId,
    startDate,
    endDate,
    recipients = []
  } = req.body;

  if (!templateId || !clientWorkspaceId) {
    return sendError(res, 'Template ID and client workspace ID are required', 400);
  }

  const template = await ReportTemplate.findById(templateId);
  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  // Calculate date range if not provided
  let finalStartDate = startDate;
  let finalEndDate = endDate;

  if (!finalStartDate || !finalEndDate) {
    const now = new Date();
    switch (template.filters.defaultDateRange) {
      case 'last_7_days':
        finalEndDate = now;
        finalStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        finalEndDate = now;
        finalStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        finalEndDate = now;
        finalStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        finalStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        finalEndDate = now;
        break;
      case 'last_month':
        finalStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        finalEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        finalEndDate = now;
        finalStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  const report = await generateClientReport(agencyWorkspaceId, clientWorkspaceId, template.format, {
    startDate: finalStartDate,
    endDate: finalEndDate,
    includeROI: template.filters.includeROI,
    includeGrowth: template.filters.includeGrowth,
    includeHighlights: template.filters.includeHighlights,
    includePlatforms: template.filters.includePlatforms
  });

  // Set headers
  const filename = `report-${clientWorkspaceId}-${Date.now()}.${template.format === 'excel' ? 'xlsx' : template.format}`;
  
  if (template.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  } else if (template.format === 'excel' || template.format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  } else if (template.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  }
}));

/**
 * POST /api/agency/:agencyWorkspaceId/reports/compare
 * Generate comparison report
 */
router.post('/:agencyWorkspaceId/reports/compare', auth, requireWorkspaceAccess('canExportData'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    clientWorkspaceId,
    format = 'pdf',
    period1,
    period2,
    includeROI = true,
    includeGrowth = true
  } = req.body;

  if (!clientWorkspaceId || !period1 || !period2) {
    return sendError(res, 'Client workspace ID and both periods are required', 400);
  }

  const comparison = await generateComparisonReport(
    agencyWorkspaceId,
    clientWorkspaceId,
    format,
    { period1, period2, includeROI, includeGrowth }
  );

  // For now, return JSON. In production, would generate combined report
  sendSuccess(res, 'Comparison report generated', 200, comparison);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/reports/templates/:templateId
 * Update report template
 */
router.put('/:agencyWorkspaceId/reports/templates/:templateId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await ReportTemplate.findById(templateId);

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  // If setting as default, unset other defaults
  if (req.body.isDefault) {
    await ReportTemplate.updateMany(
      { agencyWorkspaceId: template.agencyWorkspaceId, isDefault: true, _id: { $ne: templateId } },
      { isDefault: false }
    );
  }

  Object.assign(template, req.body);
  await template.save();

  sendSuccess(res, 'Template updated', 200, template);
}));

/**
 * DELETE /api/agency/:agencyWorkspaceId/reports/templates/:templateId
 * Delete report template
 */
router.delete('/:agencyWorkspaceId/reports/templates/:templateId', auth, requireWorkspaceAccess('canDelete'), asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  await ReportTemplate.findByIdAndDelete(templateId);
  sendSuccess(res, 'Template deleted', 200);
}));

module.exports = router;


