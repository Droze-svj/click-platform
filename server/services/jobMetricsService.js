// Job Metrics Service
// Tracks job performance, costs, and analytics

const logger = require('../utils/logger');
const JobMetrics = require('../models/JobMetrics');

/**
 * Track job execution metrics
 */
async function trackJobMetrics(queueName, jobId, metrics) {
  try {
    const {
      duration,
      memoryUsage,
      cpuUsage,
      cost,
      success,
      error,
      retries,
    } = metrics;

    await JobMetrics.create({
      queueName,
      jobId,
      duration,
      memoryUsage,
      cpuUsage,
      cost,
      success,
      error: error?.message,
      retries,
      timestamp: new Date(),
    });

    logger.debug('Job metrics tracked', { queueName, jobId, duration });
  } catch (error) {
    logger.warn('Failed to track job metrics', { error: error.message });
  }
}

/**
 * Get job metrics for a queue
 */
async function getQueueMetrics(queueName, timeRange = '24h') {
  try {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const metrics = await JobMetrics.find({
      queueName,
      timestamp: { $gte: startDate },
    });

    const stats = {
      total: metrics.length,
      successful: metrics.filter(m => m.success).length,
      failed: metrics.filter(m => !m.success).length,
      averageDuration: 0,
      averageMemory: 0,
      totalCost: 0,
      totalRetries: 0,
    };

    if (metrics.length > 0) {
      stats.averageDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length;
      stats.averageMemory = metrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / metrics.length;
      stats.totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
      stats.totalRetries = metrics.reduce((sum, m) => sum + (m.retries || 0), 0);
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get queue metrics', { error: error.message });
    throw error;
  }
}

/**
 * Get user job metrics
 */
async function getUserJobMetrics(userId, timeRange = '24h') {
  try {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get jobs from all queues and aggregate metrics
    const { getQueue } = require('./jobQueueService');
    const { QUEUE_NAMES } = require('../queues');

    const userMetrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalCost: 0,
      queues: {},
    };

    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const queue = getQueue(queueName);
        const [completed, failed] = await Promise.all([
          queue.getCompleted(0, 1000),
          queue.getFailed(0, 1000),
        ]);

        const userCompleted = completed.filter(job => {
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          return jobUserId === userId;
        });

        const userFailed = failed.filter(job => {
          const jobUserId = job.data?.userId?.toString() || job.data?.user?._id?.toString() || job.data?.user?.toString();
          return jobUserId === userId;
        });

        userMetrics.queues[queueName] = {
          completed: userCompleted.length,
          failed: userFailed.length,
        };

        userMetrics.totalJobs += userCompleted.length + userFailed.length;
        userMetrics.successfulJobs += userCompleted.length;
        userMetrics.failedJobs += userFailed.length;
      } catch (error) {
        logger.warn('Failed to get metrics for queue', { queue: queueName, error: error.message });
      }
    }

    return userMetrics;
  } catch (error) {
    logger.error('Failed to get user job metrics', { error: error.message });
    throw error;
  }
}

/**
 * Calculate job cost based on resources used
 */
function calculateJobCost(queueName, duration, memoryUsage, options = {}) {
  // Base cost per second
  const baseCosts = {
    'video-processing': 0.001, // $0.001 per second
    'content-generation': 0.0005,
    'transcript-generation': 0.0008,
    'social-posting': 0.0001,
    'email-sending': 0.00005,
    'scheduled-posts': 0.0001,
  };

  const baseCost = baseCosts[queueName] || 0.0001;
  const durationSeconds = duration / 1000;
  const memoryCost = (memoryUsage / 1024 / 1024) * 0.00001; // $0.00001 per MB

  return (baseCost * durationSeconds) + memoryCost;
}

module.exports = {
  trackJobMetrics,
  getQueueMetrics,
  getUserJobMetrics,
  calculateJobCost,
};



