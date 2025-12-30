// Background job queue service using BullMQ

const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Redis connection configuration
let redisConnection = null;

function getRedisConnection() {
  // Return cached connection if already created
  if (redisConnection !== null) {
    return redisConnection;
  }

  // Check if Redis is configured (validate non-empty strings)
  const redisUrl = process.env.REDIS_URL?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();
  
  if ((!redisUrl || redisUrl === '') && (!redisHost || redisHost === '')) {
    logger.warn('⚠️ Redis not configured for job queues. Workers will be disabled.');
    logger.warn('⚠️ Set REDIS_URL environment variable to enable workers.');
    return null;
  }

  // Support both REDIS_URL and individual config
  if (redisUrl && redisUrl !== '') {
    // Validate URL format
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('⚠️ Invalid REDIS_URL format. Must start with redis:// or rediss://');
      logger.warn('⚠️ Workers will be disabled until REDIS_URL is fixed.');
      return null;
    }
    
    logger.info('Using REDIS_URL for job queue connection', { 
      url: redisUrl.replace(/:[^:@]+@/, ':****@') // Hide password in logs
    });
    // BullMQ/ioredis accepts connection string directly
    // Pass the URL string directly, not wrapped in an object
    redisConnection = redisUrl;
    return redisConnection;
  }

  // Fallback to individual config (for local development only)
  // Only allow localhost fallback in development
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    logger.error('⚠️ REDIS_URL is required in production/staging. Workers will be disabled.');
    return null;
  }

  logger.info('Using individual Redis config for job queue connection (development only)');
  redisConnection = {
    host: redisHost || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
  return redisConnection;
}

// Job queues
const queues = {};
const workers = {};
const queueEvents = {};

/**
 * Get or create a queue
 */
function getQueue(name) {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error('Redis not configured. Cannot create queue.');
  }

  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Set up queue events
    queueEvents[name] = new QueueEvents(name, { connection: connection });

    queueEvents[name].on('completed', ({ jobId }) => {
      logger.info('Job completed', { queue: name, jobId });
    });

    queueEvents[name].on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { queue: name, jobId, reason: failedReason });
      captureException(new Error(failedReason), {
        tags: { queue: name, jobId },
      });
    });

    queueEvents[name].on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { queue: name, jobId, progress: data });
    });
  }

  return queues[name];
}

/**
 * Add job to queue
 */
async function addJob(queueName, jobData, options = {}) {
  // Check if Redis is available before adding job
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn(`⚠️ Cannot add job to ${queueName} - Redis not configured`);
    throw new Error('Redis not configured. Cannot add job to queue.');
  }

  try {
    const queue = getQueue(queueName);
    const job = await queue.add(jobData.name || 'job', jobData.data || {}, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      ...options,
    });

    logger.info('Job added to queue', {
      queue: queueName,
      jobId: job.id,
      priority: options.priority,
    });

    return job;
  } catch (error) {
    logger.error('Failed to add job', { queue: queueName, error: error.message });
    throw error;
  }
}

/**
 * Create worker for a queue
 */
function createWorker(queueName, processor, options = {}) {
  // Get Redis connection (will return null if not configured)
  const connection = getRedisConnection();
  
  // Skip worker creation if Redis is not configured
  if (!connection) {
    logger.warn(`⚠️ Skipping worker creation for ${queueName} - Redis not configured`);
    return null;
  }

  if (workers[queueName]) {
    logger.warn('Worker already exists for queue', { queue: queueName });
    return workers[queueName];
  }

  try {
    const worker = new Worker(
    queueName,
    async (job) => {
      logger.info('Processing job', {
        queue: queueName,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await processor(job.data, job);
        logger.info('Job processed successfully', {
          queue: queueName,
          jobId: job.id,
        });
        return result;
      } catch (error) {
        logger.error('Job processing error', {
          queue: queueName,
          jobId: job.id,
          error: error.message,
        });
        throw error;
      }
    },
    {
      connection: connection,
      concurrency: options.concurrency || 1,
      limiter: options.limiter,
      ...options,
    }
  );

    worker.on('completed', async (job) => {
    const duration = job.finishedOn - job.processedOn;
    
    logger.info('Worker completed job', {
      queue: queueName,
      jobId: job.id,
      duration,
    });

    // Track metrics
    try {
      const { trackJobMetrics, calculateJobCost } = require('./jobMetricsService');
      const processMemoryUsage = process.memoryUsage();
      
      await trackJobMetrics(queueName, job.id, {
        duration,
        memoryUsage: processMemoryUsage.heapUsed,
        cpuUsage: 0, // Would need additional monitoring
        cost: calculateJobCost(queueName, duration, processMemoryUsage.heapUsed),
        success: true,
        retries: job.attemptsMade,
      });
    } catch (error) {
      logger.warn('Failed to track job metrics', { error: error.message });
    }

    // Process job dependencies
    try {
      const { processJobDependencies } = require('./jobDependencyService');
      await processJobDependencies(job.id, queueName);
    } catch (error) {
      logger.warn('Failed to process job dependencies', { error: error.message });
    }
  });

  worker.on('failed', async (job, err) => {
    logger.error('Worker failed job', {
      queue: queueName,
      jobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });

    // Move to dead letter queue if max attempts reached
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      try {
        const { moveToDeadLetter } = require('./jobDeadLetterService');
        await moveToDeadLetter(queueName, job.id, err.message);
      } catch (error) {
        logger.error('Failed to move job to dead letter queue', {
          jobId: job.id,
          error: error.message,
        });
      }
    }

    // Process job dependencies even on failure (optional)
    try {
      const { processJobDependencies } = require('./jobDependencyService');
      await processJobDependencies(job.id, queueName);
    } catch (error) {
      // Ignore dependency processing errors
    }
  });

    worker.on('error', (err) => {
      logger.error('Worker error', { queue: queueName, error: err.message });
      captureException(err, { tags: { queue: queueName, type: 'worker_error' } });
    });

    workers[queueName] = worker;
    logger.info(`Worker created for queue: ${queueName}`);
    
    return worker;
  } catch (error) {
    logger.error(`Failed to create worker for ${queueName}`, { error: error.message });
    // Don't throw - workers are optional
    return null;
  }
}

/**
 * Get job status
 */
async function getJobStatus(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      id: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      createdAt: new Date(job.timestamp),
    };
  } catch (error) {
    logger.error('Failed to get job status', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  try {
    const queue = getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { queue: queueName, error: error.message });
    throw error;
  }
}

/**
 * Cancel job
 */
async function cancelJob(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    logger.info('Job cancelled', { queue: queueName, jobId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel job', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Retry failed job
 */
async function retryJob(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.retry();
    logger.info('Job retried', { queue: queueName, jobId });
    return true;
  } catch (error) {
    logger.error('Failed to retry job', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Clean up old jobs
 */
async function cleanQueue(queueName, grace = 5000) {
  try {
    const queue = getQueue(queueName);
    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');
    logger.info('Queue cleaned', { queue: queueName });
  } catch (error) {
    logger.error('Failed to clean queue', { queue: queueName, error: error.message });
  }
}

/**
 * Close all queues and workers
 */
async function closeAll() {
  try {
    // Close all workers
    for (const [name, worker] of Object.entries(workers)) {
      await worker.close();
      logger.info('Worker closed', { queue: name });
    }

    // Close all queues
    for (const [name, queue] of Object.entries(queues)) {
      await queue.close();
      logger.info('Queue closed', { queue: name });
    }

    // Close all queue events
    for (const [name, events] of Object.entries(queueEvents)) {
      await events.close();
    }

    logger.info('All queues and workers closed');
  } catch (error) {
    logger.error('Error closing queues', { error: error.message });
  }
}

module.exports = {
  getQueue,
  addJob,
  createWorker,
  getJobStatus,
  getQueueStats,
  cancelJob,
  retryJob,
  cleanQueue,
  closeAll,
};




