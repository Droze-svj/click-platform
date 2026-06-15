// Job queue management routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  getJobStatus,
  getQueueStats,
  cancelJob,
  retryJob,
} = require('../services/jobQueueService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

// Import dashboard routes
const dashboardRoutes = require('./jobs/dashboard');
const userRoutes = require('./jobs/user');
const metricsRoutes = require('./jobs/metrics');
const deadLetterRoutes = require('./jobs/dead-letter');
router.use('/', dashboardRoutes);
router.use('/', userRoutes);
router.use('/metrics', metricsRoutes);
router.use('/dead-letter', deadLetterRoutes);

// A job belongs to the user whose id is embedded in its payload (jobs are enqueued
// with { user: { _id } } or { userId }). Used to scope status/cancel/retry so a
// user can only inspect/mutate their OWN jobs — BullMQ job ids are guessable
// sequential integers, so without this any user could read another user's job
// data (prompts/PII) or cancel/replay their jobs. Returns '' when unknown.
function jobOwnerId(status) {
  const d = status && status.data ? status.data : null;
  if (!d) return '';
  return String((d.user && d.user._id) || d.userId || '');
}

/**
 * GET /api/jobs
 * Get all queues overview (user's jobs)
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  
  try {
    const { getAllQueueStats } = require('../queues');
    const stats = await getAllQueueStats();
    
    // Filter to show only user-relevant stats
    sendSuccess(res, 'Job queues overview', 200, stats);
  } catch (error) {
    logger.error('Get jobs overview error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * GET /api/jobs/status/:queueName/:jobId
 * Get job status
 */
router.get('/status/:queueName/:jobId', auth, asyncHandler(async (req, res) => {
  const { queueName, jobId } = req.params;

  try {
    const status = await getJobStatus(queueName, jobId);
    if (!status || jobOwnerId(status) !== String(req.user._id)) {
      return sendError(res, 'Job not found', 404);
    }
    sendSuccess(res, 'Job status fetched', 200, status);
  } catch (error) {
    logger.error('Get job status error', { error: error.message, queueName, jobId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/jobs/stats/:queueName:
 *   get:
 *     summary: Get queue statistics
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats/:queueName', auth, asyncHandler(async (req, res) => {
  const { queueName } = req.params;

  try {
    const stats = await getQueueStats(queueName);
    sendSuccess(res, 'Queue stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get queue stats error', { error: error.message, queueName });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/jobs/cancel/:queueName/:jobId:
 *   post:
 *     summary: Cancel job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cancel/:queueName/:jobId', auth, asyncHandler(async (req, res) => {
  const { queueName, jobId } = req.params;

  try {
    const owned = await getJobStatus(queueName, jobId);
    if (!owned || jobOwnerId(owned) !== String(req.user._id)) {
      return sendError(res, 'Job not found', 404);
    }
    await cancelJob(queueName, jobId);
    sendSuccess(res, 'Job cancelled successfully', 200);
  } catch (error) {
    logger.error('Cancel job error', { error: error.message, queueName, jobId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/jobs/retry/:queueName/:jobId:
 *   post:
 *     summary: Retry failed job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/retry/:queueName/:jobId', auth, asyncHandler(async (req, res) => {
  const { queueName, jobId } = req.params;

  try {
    const owned = await getJobStatus(queueName, jobId);
    if (!owned || jobOwnerId(owned) !== String(req.user._id)) {
      return sendError(res, 'Job not found', 404);
    }
    await retryJob(queueName, jobId);
    sendSuccess(res, 'Job retried successfully', 200);
  } catch (error) {
    logger.error('Retry job error', { error: error.message, queueName, jobId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;




