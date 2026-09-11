// Export Routes
// Robust export with retry logic

const express = require('express');
const auth = require('../middleware/auth');
const { checkExportQuota, addTierContext } = require('../middleware/tierGate');
const usageService = require('../services/usageService');

const asyncHandler = require('../middleware/asyncHandler');
const { parseRequestJson } = require('../utils/safeJson');
const { sendSuccess, sendError } = require('../utils/response');
const { createExportJob, getExportJobStatus, retryExport } = require('../services/robustExportService');
const { createExportTemplate, getExportTemplates, useExportTemplate, getExportHistory, getExportAnalytics, scheduleExport } = require('../services/exportEnhancementService');
const { validateExportRequest, generateExportPreview } = require('../services/exportValidationService');
const { notifyExportEvent } = require('../services/exportNotificationService');
const { getUserIdFromReq } = require('../utils/userId');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * Helper to log export-specific events
 */
const logExportServer = (event, data) => {
  logger.info(`Export Service Event: ${event}`, { ...data, context: 'export-server' });
};

/**
 * POST /api/export
 * Create export job
 */
router.post('/', auth, addTierContext, checkExportQuota, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const { type, format, filters, options } = req.body;

  logExportServer('export_request_received', {
    userId,
    type,
    format,
    hasFilters: !!filters,
    hasOptions: !!options,
    filtersKeys: filters ? Object.keys(filters) : [],
    optionsKeys: options ? Object.keys(options) : []
  });

  if (!type || !format) {
    logExportServer('export_error_validation', {
      userId,
      type,
      format,
      error: 'Type and format are required'
    });
    return sendError(res, 'Type and format are required', 400);
  }

  try {
    const job = await createExportJob(userId, {
      type,
      format,
      filters: filters || {},
      options: options || {}
    });

    logExportServer('export_job_created', {
      userId,
      jobId: job?.id || job?._id,
      type,
      format
    });

    // Record the metered export against the user's monthly quota. Best-effort:
    // a counter-write failure must not fail an already-created export job.
    usageService.incrementUsage(userId, 'exports').catch((e) => {
      logger.warn('Failed to increment export usage counter', { userId, error: e.message });
    });

    sendSuccess(res, 'Export job created', 201, job);
  } catch (error) {
    logExportServer('export_error_job_creation', {
      userId,
      type,
      format,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/export/batch
 * Multi-format parallel export (e.g. from MultiFormatExportView)
 */
router.post('/batch', auth, addTierContext, checkExportQuota, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const { videoId, formatIds, options } = req.body;

  if (!videoId || !Array.isArray(formatIds) || formatIds.length === 0) {
    return sendError(res, 'videoId and a non-empty formatIds array are required', 400);
  }

  logExportServer('batch_export_request_received', {
    userId,
    videoId,
    formatCount: formatIds.length,
    formats: formatIds
  });

  const results = [];
  for (const format of formatIds) {
    const job = await createExportJob(userId, {
      type: 'content',
      format,
      filters: { contentId: videoId },
      options: options || {}
    });
    results.push({
      format,
      jobId: job.id || job._id,
      status: job.status || 'pending',
    });
  }

  usageService.incrementUsage(userId, 'exports').catch((e) => {
    logger.warn('Failed to increment export usage counter', { userId, error: e.message });
  });

  sendSuccess(res, 'Batch export started', 201, { results });
}));

/**
 * POST /api/export/:jobId/retry
 * Retry failed export
 */
router.post('/:jobId/retry', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;

  const job = await retryExport(jobId, userId);
  sendSuccess(res, 'Export retry initiated', 200, job);
}));

/**
 * POST /api/export/templates
 * Create export template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const template = await createExportTemplate(userId, req.body);
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * GET /api/export/templates
 * Get export templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const { includeShared = true } = req.query;
  const templates = await getExportTemplates(userId, includeShared === 'true');
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * POST /api/export/templates/:templateId/use
 * Use export template
 */
router.post('/templates/:templateId/use', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const job = await useExportTemplate(templateId, userId, req.body);
  sendSuccess(res, 'Export started', 200, job);
}));

/**
 * POST /api/export/templates/:templateId/schedule
 * Schedule export
 */
router.post('/templates/:templateId/schedule', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const template = await scheduleExport(templateId, userId, req.body);
  sendSuccess(res, 'Export scheduled', 200, template);
}));

/**
 * GET /api/export/history
 * Get export history
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const history = await getExportHistory(userId, req.query);
  sendSuccess(res, 'History retrieved', 200, { history });
}));

/**
 * GET /api/export/analytics
 * Get export analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const { period = 'month' } = req.query;
  const analytics = await getExportAnalytics(userId, period);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * POST /api/export/validate
 * Validate export request
 */
router.post('/validate', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const validation = await validateExportRequest(userId, req.body);
  sendSuccess(res, 'Export validated', 200, validation);
}));

/**
 * GET /api/export/preview
 * Get export preview
 */
router.get('/preview', auth, asyncHandler(async (req, res) => {
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
  const { type, format, filters, limit = 10 } = req.query;
  
  if (!type || !format) {
    return sendError(res, 'Type and format are required', 400);
  }

  const preview = await generateExportPreview(userId, {
    type,
    format,
    filters: filters ? parseRequestJson(filters, 'filters') : {}
  }, parseInt(limit, 10));

  sendSuccess(res, 'Preview generated', 200, preview);
}));

/**
 * GET /api/export/:jobId
 * Get export job status
 */
router.get('/:jobId', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;

  const status = await getExportJobStatus(jobId, userId);
  sendSuccess(res, 'Export status retrieved', 200, status);
}));

module.exports = router;
