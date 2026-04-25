// Distributed Tracing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getTrace,
  searchTraces,
  getTraceStats,
  generateTraceId,
  exportOpenTelemetry,
} = require('../../services/distributedTracingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/monitoring/tracing/:traceId:
 *   get:
 *     summary: Get trace
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:traceId', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { traceId } = req.params;

  try {
    const trace = getTrace(traceId);
    if (!trace) {
      return sendError(res, 'Trace not found', 404);
    }
    sendSuccess(res, 'Trace fetched', 200, trace);
  } catch (error) {
    logger.error('Get trace error', { error: error.message, traceId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/tracing/search:
 *   get:
 *     summary: Search traces
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/search', auth, requireAdmin, asyncHandler(async (req, res) => {
  const {
    serviceName,
    operationName,
    minDuration,
    maxDuration,
    startTime,
    endTime,
  } = req.query;

  try {
    const filters = {};
    if (serviceName) filters.serviceName = serviceName;
    if (operationName) filters.operationName = operationName;
    if (minDuration) filters.minDuration = parseInt(minDuration);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration);
    if (startTime) filters.startTime = parseInt(startTime);
    if (endTime) filters.endTime = parseInt(endTime);

    const traces = searchTraces(filters);
    sendSuccess(res, 'Traces searched', 200, traces);
  } catch (error) {
    logger.error('Search traces error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/tracing/stats:
 *   get:
 *     summary: Get trace statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { serviceName } = req.query;

  try {
    const stats = getTraceStats(serviceName);
    sendSuccess(res, 'Trace stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get trace stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/tracing/generate-id:
 *   get:
 *     summary: Generate trace ID
 *     tags: [Monitoring]
 */
router.get('/generate-id', asyncHandler(async (req, res) => {
  try {
    const traceId = generateTraceId();
    sendSuccess(res, 'Trace ID generated', 200, { traceId });
  } catch (error) {
    logger.error('Generate trace ID error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/tracing/:traceId/export:
 *   get:
 *     summary: Export trace in OpenTelemetry format
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:traceId/export', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { traceId } = req.params;

  try {
    const exportData = exportOpenTelemetry(traceId);
    if (!exportData) {
      return sendError(res, 'Trace not found', 404);
    }
    sendSuccess(res, 'Trace exported', 200, exportData);
  } catch (error) {
    logger.error('Export trace error', { error: error.message, traceId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






