// Job Batching Service
// Handles batch processing of multiple jobs

const { addJob, getQueue } = require('./jobQueueService');
const { QUEUE_NAMES } = require('../queues');
const logger = require('../utils/logger');

/**
 * Add multiple jobs as a batch
 */
async function addBatchJobs(queueName, jobs, options = {}) {
  try {
    const queue = getQueue(queueName);
    const addedJobs = [];

    for (const jobData of jobs) {
      const job = await queue.add(jobData.name || 'batch-job', jobData.data || {}, {
        priority: options.priority || 0,
        attempts: options.attempts || 3,
        ...options,
        ...jobData.options,
      });

      addedJobs.push({
        id: job.id,
        name: job.name,
        data: job.data,
      });
    }

    logger.info('Batch jobs added', {
      queue: queueName,
      count: addedJobs.length,
    });

    return addedJobs;
  } catch (error) {
    logger.error('Failed to add batch jobs', {
      queue: queueName,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Process jobs in batches with size limit
 */
async function processBatch(queueName, processor, batchSize = 10) {
  try {
    const queue = getQueue(queueName);
    const waitingJobs = await queue.getWaiting(0, batchSize);

    if (waitingJobs.length === 0) {
      return { processed: 0, results: [] };
    }

    const results = [];
    const batch = waitingJobs.map(job => ({
      id: job.id,
      data: job.data,
      job,
    }));

    logger.info('Processing batch', {
      queue: queueName,
      batchSize: batch.length,
    });

    // Process batch
    const batchResult = await processor(batch);

    results.push({
      batchSize: batch.length,
      result: batchResult,
    });

    return {
      processed: batch.length,
      results,
    };
  } catch (error) {
    logger.error('Batch processing failed', {
      queue: queueName,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create a batch job that processes multiple items
 */
async function createBatchJob(queueName, items, batchProcessor, options = {}) {
  try {
    const batchSize = options.batchSize || 10;
    const batches = [];

    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    logger.info('Created batch job', {
      queue: queueName,
      totalItems: items.length,
      batchCount: batches.length,
      batchSize,
    });

    // Add batch processing job
    const job = await addJob(queueName, {
      name: 'process-batch',
      data: {
        batches,
        batchProcessor,
        totalItems: items.length,
        batchCount: batches.length,
      },
    }, {
      priority: options.priority || 0,
      attempts: options.attempts || 2,
      ...options,
    });

    return job;
  } catch (error) {
    logger.error('Failed to create batch job', {
      queue: queueName,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  addBatchJobs,
  processBatch,
  createBatchJob,
};



