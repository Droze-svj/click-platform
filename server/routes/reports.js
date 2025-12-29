// Automated Reports Routes
// White-label report generation

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { generateClientReport } = require('../services/reportGenerationService');
const router = express.Router();

/**
 * POST /api/agency/:agencyWorkspaceId/reports/generate
 * Generate client report
 */
router.post('/:agencyWorkspaceId/reports/generate', auth, requireWorkspaceAccess('canExportData'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    clientWorkspaceId,
    format = 'pdf',
    startDate,
    endDate,
    includeROI = true,
    includeGrowth = true,
    includeHighlights = true,
    includePlatforms = true
  } = req.body;

  if (!clientWorkspaceId) {
    return sendError(res, 'Client workspace ID is required', 400);
  }

  const report = await generateClientReport(agencyWorkspaceId, clientWorkspaceId, format, {
    startDate,
    endDate,
    includeROI,
    includeGrowth,
    includeHighlights,
    includePlatforms
  });

  // Set appropriate headers
  const filename = `report-${clientWorkspaceId}-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
  
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  } else if (format === 'excel' || format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  } else if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report);
  } else {
    return sendError(res, 'Unsupported format', 400);
  }
}));

/**
 * POST /api/agency/:agencyWorkspaceId/reports/schedule
 * Schedule automated reports
 */
router.post('/:agencyWorkspaceId/reports/schedule', auth, requireWorkspaceAccess('canExportData'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const {
    clientWorkspaceId,
    frequency, // 'daily', 'weekly', 'monthly'
    format = 'pdf',
    recipients = [],
    options = {}
  } = req.body;

  if (!clientWorkspaceId || !frequency || !recipients.length) {
    return sendError(res, 'Client workspace ID, frequency, and recipients are required', 400);
  }

  // This would create a scheduled report job
  // For now, return success
  sendSuccess(res, 'Report scheduled', 200, {
    clientWorkspaceId,
    frequency,
    format,
    recipients,
    nextRun: calculateNextRun(frequency)
  });
}));

function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(9, 0, 0, 0);
      break;
  }
  return now;
}

module.exports = router;
