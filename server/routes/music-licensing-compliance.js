// Music Licensing Compliance Routes
// Compliance checks, reports, validation, and quotas

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { validateLicense, validateTracks, checkLicenseExpiration } = require('../services/musicLicenseValidationService');
const { checkUsageQuota, canUseTrack, getQuotaStatistics } = require('../services/musicUsageQuotaService');
const { generateComplianceReport, exportUsageLogs } = require('../services/musicComplianceReportService');
const { runComplianceCheck, autoFixComplianceIssues } = require('../services/musicComplianceCheckService');
const router = express.Router();

/**
 * @route POST /api/music-licensing/validate
 * @desc Validate license for track usage
 * @access Private
 */
router.post('/validate', auth, asyncHandler(async (req, res) => {
  const {
    trackId,
    source,
    exportPlatform,
    exportFormat
  } = req.body;

  if (!trackId || !source) {
    return sendError(res, 'trackId and source are required', 400);
  }

  try {
    const validation = await validateLicense(
      trackId,
      source,
      req.user._id,
      {
        exportPlatform,
        exportFormat
      }
    );

    sendSuccess(res, 'License validated', 200, validation);
  } catch (error) {
    logger.error('Error validating license', { error: error.message });
    sendError(res, error.message || 'Failed to validate license', 500);
  }
}));

/**
 * @route POST /api/music-licensing/validate/tracks
 * @desc Validate multiple tracks
 * @access Private
 */
router.post('/validate/tracks', auth, asyncHandler(async (req, res) => {
  const {
    tracks,
    exportPlatform,
    exportFormat
  } = req.body;

  if (!tracks || !Array.isArray(tracks)) {
    return sendError(res, 'tracks array is required', 400);
  }

  try {
    const validation = await validateTracks(
      tracks,
      req.user._id,
      {
        exportPlatform,
        exportFormat
      }
    );

    sendSuccess(res, 'Tracks validated', 200, validation);
  } catch (error) {
    logger.error('Error validating tracks', { error: error.message });
    sendError(res, error.message || 'Failed to validate tracks', 500);
  }
}));

/**
 * @route GET /api/music-licensing/quota
 * @desc Check usage quota
 * @access Private
 */
router.get('/quota', auth, asyncHandler(async (req, res) => {
  const { quotaType = 'monthly' } = req.query;

  try {
    const quota = await checkUsageQuota(
      req.user._id,
      req.user.workspaceId,
      quotaType
    );

    sendSuccess(res, 'Quota retrieved', 200, quota);
  } catch (error) {
    logger.error('Error checking quota', { error: error.message });
    sendError(res, error.message || 'Failed to check quota', 500);
  }
}));

/**
 * @route GET /api/music-licensing/quota/statistics
 * @desc Get quota statistics
 * @access Private
 */
router.get('/quota/statistics', auth, asyncHandler(async (req, res) => {
  try {
    const statistics = await getQuotaStatistics(
      req.user._id,
      req.user.workspaceId
    );

    sendSuccess(res, 'Quota statistics retrieved', 200, statistics);
  } catch (error) {
    logger.error('Error getting quota statistics', { error: error.message });
    sendError(res, error.message || 'Failed to get quota statistics', 500);
  }
}));

/**
 * @route GET /api/music-licensing/track/:trackId/can-use
 * @desc Check if user can use track (quota check)
 * @access Private
 */
router.get('/track/:trackId/can-use', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.query;

  if (!source) {
    return sendError(res, 'source query parameter is required', 400);
  }

  try {
    const result = await canUseTrack(
      req.user._id,
      req.user.workspaceId,
      trackId,
      source
    );

    sendSuccess(res, 'Usage permission checked', 200, result);
  } catch (error) {
    logger.error('Error checking usage permission', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to check usage permission', 500);
  }
}));

/**
 * @route GET /api/music-licensing/track/:trackId/expiration
 * @desc Check license expiration
 * @access Private
 */
router.get('/track/:trackId/expiration', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const { source } = req.query;

  if (!source) {
    return sendError(res, 'source query parameter is required', 400);
  }

  try {
    const expiration = await checkLicenseExpiration(trackId, source);

    sendSuccess(res, 'Expiration checked', 200, expiration);
  } catch (error) {
    logger.error('Error checking expiration', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to check expiration', 500);
  }
}));

/**
 * @route GET /api/music-licensing/compliance/check
 * @desc Run automated compliance check
 * @access Private
 */
router.get('/compliance/check', auth, asyncHandler(async (req, res) => {
  const {
    checkAttribution = 'true',
    checkRegistration = 'true',
    checkExpiration = 'true',
    checkRestrictions = 'true'
  } = req.query;

  try {
    const result = await runComplianceCheck(
      req.user._id,
      req.user.workspaceId,
      {
        checkAttribution: checkAttribution === 'true',
        checkRegistration: checkRegistration === 'true',
        checkExpiration: checkExpiration === 'true',
        checkRestrictions: checkRestrictions === 'true'
      }
    );

    sendSuccess(res, 'Compliance check completed', 200, result);
  } catch (error) {
    logger.error('Error running compliance check', { error: error.message });
    sendError(res, error.message || 'Failed to run compliance check', 500);
  }
}));

/**
 * @route POST /api/music-licensing/compliance/auto-fix/:usageLogId
 * @desc Auto-fix compliance issues
 * @access Private
 */
router.post('/compliance/auto-fix/:usageLogId', auth, asyncHandler(async (req, res) => {
  const { usageLogId } = req.params;

  try {
    const result = await autoFixComplianceIssues(usageLogId, req.user._id);

    sendSuccess(res, 'Compliance issues auto-fixed', 200, result);
  } catch (error) {
    logger.error('Error auto-fixing compliance', { error: error.message, usageLogId });
    sendError(res, error.message || 'Failed to auto-fix compliance', 500);
  }
}));

/**
 * @route GET /api/music-licensing/report
 * @desc Generate compliance report
 * @access Private
 */
router.get('/report', auth, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    includeDetails = 'true',
    format = 'json'
  } = req.query;

  try {
    const report = await generateComplianceReport(
      req.user._id,
      req.user.workspaceId,
      {
        startDate,
        endDate,
        includeDetails: includeDetails === 'true',
        format
      }
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      return res.send(report.content);
    }

    sendSuccess(res, 'Compliance report generated', 200, report);
  } catch (error) {
    logger.error('Error generating compliance report', { error: error.message });
    sendError(res, error.message || 'Failed to generate report', 500);
  }
}));

/**
 * @route GET /api/music-licensing/export/logs
 * @desc Export usage logs
 * @access Private
 */
router.get('/export/logs', auth, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    format = 'json'
  } = req.query;

  try {
    const exportData = await exportUsageLogs(
      req.user._id,
      req.user.workspaceId,
      {
        startDate,
        endDate,
        format
      }
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      return res.send(exportData.content);
    }

    sendSuccess(res, 'Usage logs exported', 200, exportData);
  } catch (error) {
    logger.error('Error exporting usage logs', { error: error.message });
    sendError(res, error.message || 'Failed to export logs', 500);
  }
}));

/**
 * @route POST /api/music-licensing/preview-usage
 * @desc Preview license usage before render (validation + quota check)
 * @access Private
 */
router.post('/preview-usage', auth, asyncHandler(async (req, res) => {
  const {
    tracks,
    exportPlatform,
    exportFormat
  } = req.body;

  if (!tracks || !Array.isArray(tracks)) {
    return sendError(res, 'tracks array is required', 400);
  }

  try {
    // Validate all tracks
    const validation = await validateTracks(
      tracks,
      req.user._id,
      {
        exportPlatform,
        exportFormat
      }
    );

    // Check quotas
    const quota = await checkUsageQuota(req.user._id, req.user.workspaceId, 'monthly');

    // Check each track can be used
    const usageChecks = [];
    for (const track of tracks) {
      const canUse = await canUseTrack(
        req.user._id,
        req.user.workspaceId,
        track.trackId || track.id,
        track.source
      );
      usageChecks.push({
        trackId: track.trackId || track.id,
        ...canUse
      });
    }

    const allValid = validation.allValid && 
                     !quota.exceeded && 
                     usageChecks.every(check => check.allowed);

    sendSuccess(res, 'Usage preview generated', 200, {
      allValid,
      validation,
      quota,
      usageChecks,
      canProceed: allValid
    });
  } catch (error) {
    logger.error('Error previewing usage', { error: error.message });
    sendError(res, error.message || 'Failed to preview usage', 500);
  }
}));

module.exports = router;







