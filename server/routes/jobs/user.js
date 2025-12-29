// User Job Routes
// Job management for regular users

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getJobStatus,
  getQueueStats,
  cancelJob,
} = require('../../services/jobQueueService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/jobs/user
 * Get user's jobs across all queues
 */
router.get('/user', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  
  try {
    const { getQueue } = require('../../services/jobQueueService');
    const { QUEUE_NAMES } = require('../../queues');
    
    const userJobs = {
      active: [],
      completed: [],
      failed: [],
    };

    // Check all queues for user's jobs
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const queue = getQueue(queueName);
        
        // Get active jobs
        const active = await queue.getActive();
        const userActive = active.filter(job => {
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          return jobUserId === userId;
        });
        userJobs.active.push(...userActive.map(job => ({
          id: job.id,
          queue: queueName,
          name: job.name,
          progress: job.progress || 0,
          data: job.data,
        })));

        // Get completed jobs (last 20)
        const completed = await queue.getCompleted(0, 20);
        const userCompleted = completed.filter(job => {
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          return jobUserId === userId;
        });
        userJobs.completed.push(...userCompleted.map(job => ({
          id: job.id,
          queue: queueName,
          name: job.name,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        })));

        // Get failed jobs (last 10)
        const failed = await queue.getFailed(0, 10);
        const userFailed = failed.filter(job => {
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          return jobUserId === userId;
        });
        userJobs.failed.push(...userFailed.map(job => ({
          id: job.id,
          queue: queueName,
          name: job.name,
          failedReason: job.failedReason,
          failedAt: job.timestamp ? new Date(job.timestamp) : null,
        })));
      } catch (error) {
        logger.warn('Failed to get jobs from queue', { queue: queueName, error: error.message });
      }
    }

    sendSuccess(res, 'User jobs retrieved', 200, userJobs);
  } catch (error) {
    logger.error('Get user jobs error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * GET /api/jobs/user/:jobId
 * Get specific job status (if user owns it)
 */
router.get('/user/:jobId', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user._id.toString();
  
  try {
    const { getQueue } = require('../../services/jobQueueService');
    const { QUEUE_NAMES } = require('../../queues');
    
    // Search across all queues
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const queue = getQueue(queueName);
        const job = await queue.getJob(jobId);
        
        if (job) {
          // Verify ownership
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          if (jobUserId !== userId) {
            continue; // Not user's job, check next queue
          }

          const status = await getJobStatus(queueName, jobId);
          return sendSuccess(res, 'Job status retrieved', 200, status);
        }
      } catch (error) {
        // Continue searching
      }
    }

    sendError(res, 'Job not found', 404);
  } catch (error) {
    logger.error('Get user job error', { error: error.message, jobId, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * POST /api/jobs/user/:jobId/cancel
 * Cancel user's job
 */
router.post('/user/:jobId/cancel', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user._id.toString();
  
  try {
    const { getQueue } = require('../../services/jobQueueService');
    const { QUEUE_NAMES } = require('../../queues');
    
    // Find job across all queues
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const queue = getQueue(queueName);
        const job = await queue.getJob(jobId);
        
        if (job) {
          // Verify ownership
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          if (jobUserId !== userId) {
            continue;
          }

          await cancelJob(queueName, jobId);
          return sendSuccess(res, 'Job cancelled successfully', 200);
        }
      } catch (error) {
        // Continue searching
      }
    }

    sendError(res, 'Job not found', 404);
  } catch (error) {
    logger.error('Cancel user job error', { error: error.message, jobId, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;



