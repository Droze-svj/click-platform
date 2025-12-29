// Enhanced Report Routes
// Scheduled reports, comparisons, sharing, interactive charts

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { createScheduledReport } = require('../services/scheduledReportService');
const ScheduledReport = require('../models/ScheduledReport');
const { createReportComparison } = require('../services/reportComparisonService');
const ReportComparison = require('../models/ReportComparison');
const ReportShare = require('../models/ReportShare');
const { generateInteractiveChart } = require('../services/interactiveChartService');
const { generateEnhancedSummary } = require('../services/enhancedAISummaryService');
const router = express.Router();

/**
 * POST /api/reports/scheduled
 * Create scheduled report
 */
router.post('/scheduled', auth, asyncHandler(async (req, res) => {
  const scheduled = await createScheduledReport({
    ...req.body,
    createdBy: req.user._id
  });
  sendSuccess(res, 'Scheduled report created', 201, scheduled);
}));

/**
 * GET /api/reports/scheduled
 * Get scheduled reports
 */
router.get('/scheduled', auth, asyncHandler(async (req, res) => {
  const { agencyWorkspaceId, clientWorkspaceId } = req.query;
  const query = {};

  if (agencyWorkspaceId) query.agencyWorkspaceId = agencyWorkspaceId;
  if (clientWorkspaceId) query.clientWorkspaceId = clientWorkspaceId;

  const scheduled = await ScheduledReport.find(query)
    .populate('templateId')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Scheduled reports retrieved', 200, { scheduled });
}));

/**
 * POST /api/reports/compare
 * Create report comparison
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { templateId, clientWorkspaceId, agencyWorkspaceId, currentPeriod, previousPeriod } = req.body;

  if (!templateId || !clientWorkspaceId || !agencyWorkspaceId || !currentPeriod || !previousPeriod) {
    return sendError(res, 'All fields are required', 400);
  }

  const comparison = await createReportComparison(
    templateId,
    clientWorkspaceId,
    agencyWorkspaceId,
    currentPeriod,
    previousPeriod
  );

  sendSuccess(res, 'Report comparison created', 201, comparison);
}));

/**
 * GET /api/reports/compare/:comparisonId
 * Get report comparison
 */
router.get('/compare/:comparisonId', auth, asyncHandler(async (req, res) => {
  const { comparisonId } = req.params;
  const comparison = await ReportComparison.findById(comparisonId)
    .populate('periods.current.reportId')
    .populate('periods.previous.reportId')
    .lean();

  if (!comparison) {
    return sendError(res, 'Comparison not found', 404);
  }

  sendSuccess(res, 'Comparison retrieved', 200, comparison);
}));

/**
 * POST /api/reports/:reportId/share
 * Share report
 */
router.post('/:reportId/share', auth, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { shareType, password, recipients, access, expiresAt } = req.body;

  const share = new ReportShare({
    reportId,
    sharedBy: req.user._id,
    shareType: shareType || 'private',
    password,
    recipients: recipients || [],
    access: access || { canView: true, canDownload: true },
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });

  await share.save();

  sendSuccess(res, 'Report shared', 201, { share, shareUrl: `${process.env.APP_URL}/shared/${share.token}` });
}));

/**
 * GET /api/reports/shared/:token
 * Get shared report (no auth required)
 */
router.get('/shared/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.query;

  const share = await ReportShare.findOne({ token }).populate('reportId').lean();

  if (!share) {
    return sendError(res, 'Share not found', 404);
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return sendError(res, 'Share has expired', 410);
  }

  // Check password
  if (share.shareType === 'password' && share.password !== password) {
    return sendError(res, 'Invalid password', 401);
  }

  // Record view
  await ReportShare.findByIdAndUpdate(share._id, {
    $push: {
      views: {
        viewedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    }
  });

  sendSuccess(res, 'Shared report retrieved', 200, {
    report: share.reportId,
    access: share.access
  });
}));

/**
 * GET /api/reports/charts/:metricType/interactive
 * Get interactive chart
 */
router.get('/charts/:metricType/interactive', auth, asyncHandler(async (req, res) => {
  const { metricType } = req.params;
  const { clientWorkspaceId, startDate, endDate, chartType = 'line', drillDownLevel = 0 } = req.query;

  if (!clientWorkspaceId || !startDate || !endDate) {
    return sendError(res, 'Client workspace ID, start date, and end date are required', 400);
  }

  const period = {
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  };

  const chart = await generateInteractiveChart(
    metricType,
    clientWorkspaceId,
    period,
    chartType,
    parseInt(drillDownLevel)
  );

  sendSuccess(res, 'Interactive chart generated', 200, chart);
}));

/**
 * POST /api/reports/:reportId/summary/enhanced
 * Generate enhanced AI summary
 */
router.post('/:reportId/summary/enhanced', auth, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const GeneratedReport = require('../models/GeneratedReport');
  const report = await GeneratedReport.findById(reportId)
    .populate('templateId')
    .lean();

  if (!report) {
    return sendError(res, 'Report not found', 404);
  }

  const summary = await generateEnhancedSummary(report, req.body);

  // Update report
  await GeneratedReport.findByIdAndUpdate(reportId, {
    aiSummary: summary
  });

  sendSuccess(res, 'Enhanced summary generated', 200, summary);
}));

module.exports = router;

