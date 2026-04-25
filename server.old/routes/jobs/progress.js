// Job Progress Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const { getJobProgress } = require('../../services/jobQueueService');
const logger = require('../../utils/logger');

/**
 * GET /api/jobs/:queueName/:jobId/progress
 * Get job progress
 */
router.get('/:queueName/:jobId/progress', authenticate, async (req, res) => {
  try {
    const { queueName, jobId } = req.params;

    const progress = await getJobProgress(queueName, jobId);

    return sendSuccess(res, progress);
  } catch (error) {
    logger.error('Error getting job progress', { error: error.message });
    return sendError(res, error.message, 404);
  }
});

module.exports = router;
