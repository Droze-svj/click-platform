// Dead Letter Queue Routes
// Manage permanently failed jobs

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getDeadLetterJobs,
  retryDeadLetterJob,
  cleanupDeadLetterJobs,
} = require('../../services/jobDeadLetterService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/jobs/dead-letter
 * Get dead letter jobs
 */
router.get('/', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { queueName, limit = 100 } = req.query;

  try {
    const jobs = await getDeadLetterJobs(queueName, parseInt(limit));
    sendSuccess(res, 'Dead letter jobs retrieved', 200, { jobs });
  } catch (error) {
    logger.error('Get dead letter jobs error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * POST /api/jobs/dead-letter/:id/retry
 * Retry a dead letter job
 */
router.post('/:id/retry', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { queueName } = req.body;

  try {
    const job = await retryDeadLetterJob(id, queueName);
    sendSuccess(res, 'Dead letter job retried', 200, { job });
  } catch (error) {
    logger.error('Retry dead letter job error', { error: error.message, id });
    sendError(res, error.message, 500);
  }
}));

/**
 * POST /api/jobs/dead-letter/cleanup
 * Clean up old dead letter jobs
 */
router.post('/cleanup', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { olderThanDays = 30 } = req.body;

  try {
    const deleted = await cleanupDeadLetterJobs(olderThanDays);
    sendSuccess(res, 'Dead letter jobs cleaned up', 200, { deleted });
  } catch (error) {
    logger.error('Cleanup dead letter jobs error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;



