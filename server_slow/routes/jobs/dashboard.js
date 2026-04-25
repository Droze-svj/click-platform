// Job Queue Dashboard Routes
// Provides comprehensive job queue management and monitoring

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getJobStatus,
  getQueueStats,
  cancelJob,
  retryJob,
  getQueue,
} = require('../../services/jobQueueService');
const { getAllQueueStats } = require('../../queues');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/jobs/dashboard
 * Get comprehensive job queue dashboard data
 */
router.get('/dashboard', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = await getAllQueueStats();
    
    // Get recent jobs for each queue
    const recentJobs = {};
    for (const [queueName, queueStats] of Object.entries(stats)) {
      if (!queueStats.error) {
        try {
          const queue = getQueue(queueName);
          const [waiting, active, failed] = await Promise.all([
            queue.getWaiting(0, 10),
            queue.getActive(0, 10),
            queue.getFailed(0, 10),
          ]);
          
          recentJobs[queueName] = {
            waiting: waiting.map(job => ({
              id: job.id,
              name: job.name,
              data: job.data,
              priority: job.opts.priority,
              createdAt: new Date(job.timestamp),
            })),
            active: active.map(job => ({
              id: job.id,
              name: job.name,
              progress: job.progress,
              data: job.data,
              attemptsMade: job.attemptsMade,
            })),
            failed: failed.map(job => ({
              id: job.id,
              name: job.name,
              failedReason: job.failedReason,
              attemptsMade: job.attemptsMade,
              failedAt: new Date(job.timestamp),
            })),
          };
        } catch (error) {
          logger.warn('Failed to get recent jobs', { queue: queueName, error: error.message });
        }
      }
    }

    sendSuccess(res, 'Dashboard data retrieved', 200, {
      stats,
      recentJobs,
    });
  } catch (error) {
    logger.error('Get dashboard error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * GET /api/jobs/dashboard/stats
 * Get all queue statistics
 */
router.get('/dashboard/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  const stats = await getAllQueueStats();
  sendSuccess(res, 'Queue stats retrieved', 200, stats);
}));

/**
 * GET /api/jobs/dashboard/jobs/:queueName
 * Get jobs for a specific queue
 */
router.get('/dashboard/jobs/:queueName', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { queueName } = req.params;
  const { status = 'all', limit = 50, offset = 0 } = req.query;

  try {
    const queue = getQueue(queueName);
    let jobs = [];

    switch (status) {
      case 'waiting':
        jobs = await queue.getWaiting(parseInt(offset), parseInt(limit));
        break;
      case 'active':
        jobs = await queue.getActive(parseInt(offset), parseInt(limit));
        break;
      case 'completed':
        jobs = await queue.getCompleted(parseInt(offset), parseInt(limit));
        break;
      case 'failed':
        jobs = await queue.getFailed(parseInt(offset), parseInt(limit));
        break;
      case 'delayed':
        jobs = await queue.getDelayed(parseInt(offset), parseInt(limit));
        break;
      default:
        // Get all
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(0, parseInt(limit)),
          queue.getActive(0, parseInt(limit)),
          queue.getCompleted(0, parseInt(limit)),
          queue.getFailed(0, parseInt(limit)),
          queue.getDelayed(0, parseInt(limit)),
        ]);
        jobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
    }

    const formattedJobs = await Promise.all(jobs.map(async (job) => ({
      id: job.id,
      name: job.name,
      state: status !== 'all' ? status : await job.getState().catch(() => 'unknown'),
      progress: job.progress || 0,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      createdAt: new Date(job.timestamp),
    })));

    sendSuccess(res, 'Jobs retrieved', 200, {
      jobs: formattedJobs,
      total: formattedJobs.length,
    });
  } catch (error) {
    logger.error('Get jobs error', { error: error.message, queueName });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;
