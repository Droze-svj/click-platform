// Dead Letter Queue Service
// Handles permanently failed jobs

const { getQueue } = require('./jobQueueService');
const logger = require('../utils/logger');

/**
 * Move failed job to dead letter queue
 */
async function moveToDeadLetter(queueName, jobId, reason) {
  try {
    const DeadLetterJob = require('../models/DeadLetterJob');
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    // Create dead letter record
    await DeadLetterJob.create({
      originalQueueName: queueName,
      originalJobId: jobId,
      jobName: job.name,
      jobData: job.data,
      failedReason: reason || job.failedReason,
      attemptsMade: job.attemptsMade,
      originalTimestamp: new Date(job.timestamp),
      movedAt: new Date(),
    });

    // Remove from original queue
    await job.remove();

    logger.warn('Job moved to dead letter queue', {
      queue: queueName,
      jobId,
      reason,
    });

    return true;
  } catch (error) {
    logger.error('Failed to move job to dead letter queue', {
      queue: queueName,
      jobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get dead letter jobs
 */
async function getDeadLetterJobs(queueName = null, limit = 100) {
  try {
    const DeadLetterJob = require('../models/DeadLetterJob');
    const query = queueName ? { originalQueueName: queueName } : {};

    const jobs = await DeadLetterJob.find(query)
      .sort({ movedAt: -1 })
      .limit(limit);

    return jobs;
  } catch (error) {
    logger.error('Failed to get dead letter jobs', { error: error.message });
    throw error;
  }
}

/**
 * Retry dead letter job
 */
async function retryDeadLetterJob(deadLetterJobId, newQueueName = null) {
  try {
    const DeadLetterJob = require('../models/DeadLetterJob');
    const { addJob } = require('./jobQueueService');

    const deadLetterJob = await DeadLetterJob.findById(deadLetterJobId);
    if (!deadLetterJob) {
      throw new Error('Dead letter job not found');
    }

    const queueName = newQueueName || deadLetterJob.originalQueueName;

    // Add job back to queue
    const job = await addJob(queueName, {
      name: deadLetterJob.jobName,
      data: deadLetterJob.jobData,
    }, {
      attempts: 1, // Give it one more chance
      priority: 0,
    });

    // Update dead letter job
    await DeadLetterJob.findByIdAndUpdate(deadLetterJobId, {
      $set: {
        retried: true,
        retriedAt: new Date(),
        retriedJobId: job.id,
        retriedQueueName: queueName,
      },
    });

    logger.info('Dead letter job retried', {
      deadLetterJobId,
      newJobId: job.id,
    });

    return job;
  } catch (error) {
    logger.error('Failed to retry dead letter job', {
      deadLetterJobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clean up old dead letter jobs
 */
async function cleanupDeadLetterJobs(olderThanDays = 30) {
  try {
    const DeadLetterJob = require('../models/DeadLetterJob');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await DeadLetterJob.deleteMany({
      movedAt: { $lt: cutoffDate },
      retried: false, // Don't delete retried jobs
    });

    logger.info('Dead letter jobs cleaned up', {
      deleted: result.deletedCount,
      olderThanDays,
    });

    return result.deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup dead letter jobs', { error: error.message });
    throw error;
  }
}

module.exports = {
  moveToDeadLetter,
  getDeadLetterJobs,
  retryDeadLetterJob,
  cleanupDeadLetterJobs,
};



