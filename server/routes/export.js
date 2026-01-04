// Export Routes
// Robust export with retry logic

const express = require('express');
const auth = require('../middleware/auth');

const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { createExportJob, getExportJobStatus, retryExport } = require('../services/robustExportService');
const { createExportTemplate, getExportTemplates, useExportTemplate, getExportHistory, getExportAnalytics, scheduleExport } = require('../services/exportEnhancementService');
const { validateExportRequest, generateExportPreview } = require('../services/exportValidationService');
const { notifyExportEvent } = require('../services/exportNotificationService');
const router = express.Router();

/**
 * POST /api/export
 * Create export job
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
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
 * GET /api/export/:jobId
 * Get export job status
 */
router.get('/:jobId', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user._id;

  const status = await getExportJobStatus(jobId, userId);
  sendSuccess(res, 'Export status retrieved', 200, status);
}));

/**
 * POST /api/export/:jobId/retry
 * Retry failed export
 */
router.post('/:jobId/retry', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user._id;

  const job = await retryExport(jobId, userId);
  sendSuccess(res, 'Export retry initiated', 200, job);
}));

/**
 * POST /api/export/templates
 * Create export template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const template = await createExportTemplate(userId, req.body);
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * GET /api/export/templates
 * Get export templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
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
  const userId = req.user._id;
  const job = await useExportTemplate(templateId, userId, req.body);
  sendSuccess(res, 'Export started', 200, job);
}));

/**
 * POST /api/export/templates/:templateId/schedule
 * Schedule export
 */
router.post('/templates/:templateId/schedule', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const userId = req.user._id;
  const template = await scheduleExport(templateId, userId, req.body);
  sendSuccess(res, 'Export scheduled', 200, template);
}));

/**
 * GET /api/export/history
 * Get export history
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const history = await getExportHistory(userId, req.query);
  sendSuccess(res, 'History retrieved', 200, { history });
}));

/**
 * GET /api/export/analytics
 * Get export analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = 'month' } = req.query;
  const analytics = await getExportAnalytics(userId, period);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * POST /api/export/validate
 * Validate export request
 */
router.post('/validate', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const validation = await validateExportRequest(userId, req.body);
  sendSuccess(res, 'Export validated', 200, validation);
}));

/**
 * GET /api/export/preview
 * Get export preview
 */
router.get('/preview', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { type, format, filters, limit = 10 } = req.query;
  
  if (!type || !format) {
    return sendError(res, 'Type and format are required', 400);
  }

  const preview = await generateExportPreview(userId, {
    type,
    format,
    filters: filters ? JSON.parse(filters) : {}
  }, parseInt(limit));

  sendSuccess(res, 'Preview generated', 200, preview);
}));

module.exports = router;
