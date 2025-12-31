// Background job queue service using BullMQ

const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Redis connection configuration
let redisConnection = null;

// Force clear any cached connection on module load in production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  redisConnection = null; // Clear any stale cached connection
}

function getRedisConnection() {
  // In production/staging, ALWAYS require REDIS_URL (no fallbacks)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  
  // Check if Redis is configured (validate non-empty strings)
  // IMPORTANT: Use process.env.REDIS_URL directly first to check raw value
  const rawRedisUrl = process.env.REDIS_URL;
  const redisUrl = rawRedisUrl?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();
  
  // Log what we found for debugging
  logger.info('🔍 getRedisConnection() called', {
    hasRedisUrl: !!redisUrl,
    redisUrlLength: redisUrl?.length || 0,
    redisUrlPrefix: redisUrl ? redisUrl.substring(0, 30) + '...' : 'none',
    redisUrlFirstChars: redisUrl ? redisUrl.substring(0, 10) : 'none',
    redisUrlLastChars: redisUrl && redisUrl.length > 10 ? '...' + redisUrl.substring(redisUrl.length - 10) : 'none',
    hasRedisHost: !!redisHost,
    nodeEnv: process.env.NODE_ENV,
    isProduction,
    rawRedisUrlExists: !!rawRedisUrl,
    rawRedisUrlLength: rawRedisUrl?.length || 0,
    rawRedisUrlFirstChars: rawRedisUrl ? rawRedisUrl.substring(0, 20) : 'none',
    // Check for common issues
    hasQuotes: rawRedisUrl ? (rawRedisUrl.startsWith('"') || rawRedisUrl.startsWith("'")) : false,
    hasSpaces: rawRedisUrl ? rawRedisUrl.includes(' ') : false,
    cachedConnectionType: redisConnection ? typeof redisConnection : 'none',
    cachedConnectionIsLocalhost: redisConnection && typeof redisConnection === 'object' 
      ? (redisConnection.host === 'localhost' || redisConnection.host === '127.0.0.1')
      : false
  });
  
  // In production/staging, REDIS_URL is REQUIRED
  if (isProduction) {
    if (!redisUrl || redisUrl === '') {
      logger.error('⚠️ REDIS_URL is REQUIRED in production/staging but is missing or empty.');
      logger.error('⚠️ REDIS_URL value:', redisUrl ? `"${redisUrl.substring(0, 30)}..." (length: ${redisUrl.length})` : 'NOT SET OR EMPTY');
      logger.error('⚠️ Workers will be disabled. Add REDIS_URL to Render.com environment variables.');
      // Clear any cached connection
      redisConnection = null;
      return null;
    }
    
    // Validate URL format in production
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('⚠️ Invalid REDIS_URL format in production. Must start with redis:// or rediss://');
      logger.error('⚠️ REDIS_URL received:', redisUrl.substring(0, 50));
      logger.error('⚠️ Workers will be disabled until REDIS_URL is fixed.');
      redisConnection = null;
      return null;
    }
    
    // Reject localhost in production
    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      logger.error('⚠️ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.');
      logger.error('⚠️ Workers will be disabled. Use a cloud Redis service (Redis Cloud, etc.).');
      redisConnection = null;
      return null;
    }
    
    // Return cached connection if valid
    if (redisConnection !== null && typeof redisConnection === 'string' && redisConnection === redisUrl) {
      logger.info('Using cached Redis connection (production)');
      return redisConnection;
    }
    
    // Cache and return the valid production URL
    logger.info('✅ Using REDIS_URL for job queue connection (production)', { 
      url: redisUrl.replace(/:[^:@]+@/, ':****@') // Hide password in logs
    });
    redisConnection = redisUrl;
    return redisConnection;
  }
  
  // Development mode: Support both REDIS_URL and individual config
  if ((!redisUrl || redisUrl === '') && (!redisHost || redisHost === '')) {
    logger.warn('⚠️ Redis not configured for job queues. Workers will be disabled.');
    logger.warn('⚠️ Set REDIS_URL or REDIS_HOST environment variable to enable workers.');
    redisConnection = null;
    return null;
  }

  // Use REDIS_URL if available
  if (redisUrl && redisUrl !== '') {
    // Validate URL format
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('⚠️ Invalid REDIS_URL format. Must start with redis:// or rediss://');
      logger.warn('⚠️ Workers will be disabled until REDIS_URL is fixed.');
      redisConnection = null;
      return null;
    }
    
    // Return cached if same
    if (redisConnection === redisUrl) {
      logger.info('Using cached Redis connection (development)');
      return redisConnection;
    }
    
    logger.info('Using REDIS_URL for job queue connection (development)', { 
      url: redisUrl.replace(/:[^:@]+@/, ':****@') // Hide password in logs
    });
    redisConnection = redisUrl;
    return redisConnection;
  }

  // Fallback to individual config (development only)
  // CRITICAL: This should NEVER run in production
  if (isProduction) {
    logger.error('❌ FATAL: Attempted to use localhost fallback in production!');
    logger.error('❌ This should never happen. REDIS_URL must be set.');
    logger.error('❌ Clearing any cached connection and returning null.');
    redisConnection = null;
    return null;
  }
  
  logger.warn('⚠️ Using individual Redis config for job queue connection (development only)');
  logger.warn('⚠️ This should NOT happen in production!');
  
  // Return cached if same config
  if (redisConnection !== null && typeof redisConnection === 'object' && 
      redisConnection.host === (redisHost || 'localhost')) {
    return redisConnection;
  }
  
  redisConnection = {
    host: redisHost || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
  logger.warn('⚠️ Created localhost Redis connection - this will fail in production!');
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
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  
  // CRITICAL: In production, validate REDIS_URL BEFORE calling getRedisConnection()
  // This prevents any possibility of a cached localhost connection being returned
  if (isProduction) {
    const rawRedisUrl = process.env.REDIS_URL;
    const redisUrl = rawRedisUrl?.trim();
    
    logger.info(`🔍 Pre-validation for ${queueName}`, {
      hasRawRedisUrl: !!rawRedisUrl,
      rawRedisUrlLength: rawRedisUrl?.length || 0,
      hasTrimmedRedisUrl: !!redisUrl,
      trimmedRedisUrlLength: redisUrl?.length || 0,
      rawRedisUrlFirstChars: rawRedisUrl ? rawRedisUrl.substring(0, 20) : 'none',
      trimmedRedisUrlFirstChars: redisUrl ? redisUrl.substring(0, 20) : 'none'
    });
    
    if (!redisUrl || redisUrl === '') {
      logger.error(`❌ FATAL: REDIS_URL is missing or empty. Cannot create worker ${queueName}.`);
      logger.error(`❌ Raw REDIS_URL exists: ${!!rawRedisUrl}, length: ${rawRedisUrl?.length || 0}`);
      logger.error(`❌ Trimmed REDIS_URL exists: ${!!redisUrl}, length: ${redisUrl?.length || 0}`);
      return null;
    }
    
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error(`❌ FATAL: REDIS_URL format invalid for ${queueName}. Must start with redis:// or rediss://`);
      logger.error(`❌ REDIS_URL received: ${redisUrl.substring(0, 50)}`);
      return null;
    }
    
    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      logger.error(`❌ FATAL: REDIS_URL contains localhost for ${queueName}. Cannot create worker.`);
      logger.error(`❌ REDIS_URL: ${redisUrl.substring(0, 50)}`);
      return null;
    }
  }
  
  // Get Redis connection (will return null if not configured)
  const connection = getRedisConnection();
  
  // Skip worker creation if Redis is not configured
  if (!connection) {
    logger.warn(`⚠️ Skipping worker creation for ${queueName} - Redis not configured`);
    logger.warn(`⚠️ getRedisConnection() returned null for ${queueName}`);
    return null;
  }
  
  // CRITICAL: Additional safety checks before creating worker
  // Note: isProduction is already declared at the top of this function
  if (isProduction) {
    // In production, connection MUST be a valid Redis URL string
    if (typeof connection !== 'string') {
      logger.error(`⚠️ Rejecting non-string connection for ${queueName} in production`);
      logger.error(`⚠️ Connection type: ${typeof connection}`);
      return null;
    }
    
    // Must start with redis:// or rediss://
    if (!connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
      logger.error(`⚠️ Invalid Redis connection string format for ${queueName} in production`);
      logger.error(`⚠️ Connection string prefix: ${connection.substring(0, 30)}`);
      return null;
    }
    
    // Must NOT contain localhost or 127.0.0.1
    if (connection.includes('127.0.0.1') || connection.includes('localhost')) {
      logger.error(`⚠️ Rejecting localhost connection for ${queueName} in production`);
      logger.error(`⚠️ Connection contains localhost/127.0.0.1`);
      return null;
    }
  } else {
    // Development: Additional safety checks
    if (typeof connection === 'object' && connection.host === 'localhost') {
      logger.warn(`⚠️ Using localhost connection for ${queueName} (development only)`);
    }
    
    if (typeof connection === 'string' && !connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
      logger.error(`⚠️ Invalid Redis connection string format for ${queueName}`);
      logger.error(`⚠️ Connection string prefix: ${connection.substring(0, 20)}`);
      return null;
    }
  }
  
  // Final validation: Ensure connection is valid before creating Worker
  if (!connection) {
    logger.error(`❌ Cannot create worker ${queueName}: connection is null/undefined`);
    return null;
  }
  
  // In production, connection MUST be a string URL
  if (isProduction && typeof connection !== 'string') {
    logger.error(`❌ Cannot create worker ${queueName}: connection is not a string in production`);
    logger.error(`❌ Connection type: ${typeof connection}, value: ${JSON.stringify(connection)}`);
    return null;
  }
  
  logger.info(`✅ Creating worker for ${queueName} with valid Redis connection`);

  if (workers[queueName]) {
    logger.warn('Worker already exists for queue', { queue: queueName });
    return workers[queueName];
  }

  try {
    // ABSOLUTE FINAL CHECK: Ensure connection is valid before passing to BullMQ
    // BullMQ will default to localhost if connection is undefined/null/invalid
    // This check happens BEFORE any Worker creation to prevent localhost connections
    
    // Log what we're about to check
    logger.info(`🔍 Final validation for ${queueName}`, {
      hasConnection: !!connection,
      connectionType: typeof connection,
      isProduction,
      connectionPreview: typeof connection === 'string' 
        ? connection.substring(0, 50) 
        : (connection ? JSON.stringify(connection).substring(0, 50) : 'null')
    });
    
    if (!connection) {
      logger.error(`❌ FATAL: Connection is null/undefined when creating Worker for ${queueName}`);
      logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
      logger.error(`❌ This should never happen. Check REDIS_URL in Render.com environment variables.`);
      return null;
    }
    
    // Check for localhost connection object (development fallback that shouldn't happen in production)
    if (typeof connection === 'object') {
      if (connection.host === 'localhost' || connection.host === '127.0.0.1') {
        logger.error(`❌ FATAL: Connection object contains localhost for ${queueName}`);
        logger.error(`❌ Connection object: ${JSON.stringify(connection)}`);
        logger.error(`❌ This should never happen in production. REDIS_URL must be set.`);
        if (isProduction) {
          logger.error(`❌ Aborting worker creation in production.`);
          return null;
        }
      }
    }
    
    // In production, connection MUST be a valid Redis URL string
    if (isProduction) {
      if (typeof connection !== 'string') {
        logger.error(`❌ FATAL: Connection is not a string in production for ${queueName}`);
        logger.error(`❌ Connection type: ${typeof connection}, value: ${JSON.stringify(connection)}`);
        logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
        logger.error(`❌ Check REDIS_URL in Render.com - it must be a valid Redis URL string.`);
        return null;
      }
      
      if (!connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
        logger.error(`❌ FATAL: Invalid connection format for ${queueName} in production`);
        logger.error(`❌ Connection: ${connection.substring(0, 50)}`);
        logger.error(`❌ Must start with redis:// or rediss://`);
        logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
        return null;
      }
      
      if (connection.includes('127.0.0.1') || connection.includes('localhost')) {
        logger.error(`❌ FATAL: Connection contains localhost for ${queueName} in production`);
        logger.error(`❌ Connection: ${connection.substring(0, 50)}`);
        logger.error(`❌ BullMQ would connect to localhost. Aborting worker creation.`);
        logger.error(`❌ Use a cloud Redis service (Redis Cloud, etc.) - not localhost.`);
        return null;
      }
    }
    
    // Log the exact connection being used (hide password)
    const safeConnectionLog = typeof connection === 'string' 
      ? connection.replace(/:[^:@]+@/, ':****@')
      : `{ host: ${connection.host}, port: ${connection.port} }`;
    logger.info(`✅ All validation passed. Creating Worker ${queueName} with: ${safeConnectionLog}`);
    
    // CRITICAL: One final check - BullMQ will default to localhost if connection is undefined
    // Even though we've validated above, double-check right before creating Worker
    if (!connection || connection === undefined || connection === null) {
      logger.error(`❌ FATAL: Connection is ${connection} when creating Worker for ${queueName}`);
      logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
      return null;
    }
    
    // In production, ensure connection is a valid string URL
    if (isProduction && typeof connection !== 'string') {
      logger.error(`❌ FATAL: Connection is not a string in production for ${queueName}`);
      logger.error(`❌ Connection type: ${typeof connection}, value: ${JSON.stringify(connection)}`);
      logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
      return null;
    }
    
    // Final check: ensure connection doesn't contain localhost
    const connectionString = typeof connection === 'string' ? connection : JSON.stringify(connection);
    if (connectionString.includes('127.0.0.1') || connectionString.includes('localhost')) {
      logger.error(`❌ FATAL: Connection contains localhost for ${queueName}`);
      logger.error(`❌ Connection: ${connectionString.substring(0, 100)}`);
      logger.error(`❌ BullMQ would connect to localhost. Aborting worker creation.`);
      return null;
    }
    
    logger.info(`✅ Final validation passed. Creating Worker ${queueName}...`);
    
    // ABSOLUTE FINAL CHECK: Log exactly what we're passing to BullMQ
    console.log(`[${queueName}] About to create Worker with connection type: ${typeof connection}`);
    console.log(`[${queueName}] Connection preview: ${typeof connection === 'string' ? connection.substring(0, 50) : JSON.stringify(connection).substring(0, 50)}`);
    
    // Ensure connection is never undefined - BullMQ defaults to localhost if undefined
    if (connection === undefined || connection === null) {
      console.error(`[${queueName}] FATAL: Connection is ${connection} - BullMQ will default to localhost!`);
      logger.error(`❌ FATAL: Connection is ${connection} when creating Worker for ${queueName}`);
      logger.error(`❌ BullMQ will default to localhost. Aborting worker creation.`);
      return null;
    }
    
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
      connection: connection, // This is guaranteed to be valid at this point
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
      // Check if error is due to localhost connection in production
      if (err.message && err.message.includes('127.0.0.1') && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
        logger.error(`❌ CRITICAL: Worker ${queueName} is trying to connect to localhost in production!`);
        logger.error(`❌ This should never happen. REDIS_URL must be set in Render.com.`);
        logger.error(`❌ Error: ${err.message}`);
        logger.error(`❌ Closing worker to prevent further localhost connection attempts.`);
        worker.close().catch(() => {});
        delete workers[queueName];
        return;
      }
      
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




