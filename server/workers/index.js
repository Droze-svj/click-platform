// Worker Initialization
// Central entry point for all workers

const logger = require('../utils/logger');

/**
 * Initialize all workers
 */
function initializeAllWorkers() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  // Skip workers if Redis is not configured (validate non-empty strings)
  const redisUrl = process.env.REDIS_URL?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();

  // Log what we're checking
  logger.info('🔍 Checking Redis configuration for workers...', {
    hasRedisUrl: !!redisUrl,
    redisUrlLength: redisUrl?.length || 0,
    redisUrlPrefix: redisUrl ? redisUrl.substring(0, 30) + '...' : 'none',
    redisUrlFirstChars: redisUrl ? redisUrl.substring(0, 10) : 'none',
    redisUrlLastChars: redisUrl && redisUrl.length > 10 ? '...' + redisUrl.substring(redisUrl.length - 10) : 'none',
    hasRedisHost: !!redisHost,
    nodeEnv: process.env.NODE_ENV,
    isProduction,
    rawRedisUrlExists: !!process.env.REDIS_URL,
    rawRedisUrlLength: process.env.REDIS_URL?.length || 0,
    rawRedisUrlFirstChars: process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 10) : 'none'
  });

  // CRITICAL: In production/staging, REDIS_URL is REQUIRED (no fallbacks)
  if (isProduction) {
    // Use console.log for immediate visibility (not filtered by logger)
    logger.info('Initializing workers in production environment');

    if (!redisUrl || redisUrl === '') {
      const errorMsg = '❌ REDIS_URL is REQUIRED in production/staging but is missing or empty.';
      
      logger.error(errorMsg);
      logger.error('❌ Workers will NOT be initialized. Background jobs will be disabled.');
      logger.error('❌ Add REDIS_URL to Render.com environment variables to enable workers.');
      logger.error('❌ REDIS_URL value received:', redisUrl ? `"${redisUrl.substring(0, 30)}..." (length: ${redisUrl.length})` : 'NOT SET OR EMPTY');
      return;
    }

    // Validate URL format
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      const errorMsg = '❌ Invalid REDIS_URL format in production. Must start with redis:// or rediss://';
      logger.error(errorMsg);
      logger.error('❌ REDIS_URL received:', redisUrl.substring(0, 50));
      logger.error('❌ Workers will NOT be initialized until REDIS_URL is fixed.');
      return;
    }

    // Reject localhost in production
    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      const errorMsg = '❌ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.';
      
      logger.error(errorMsg);
      logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service (Redis Cloud, etc.).');
      return;
    }

    
    logger.info('✅ Redis configuration validated for production. Proceeding with worker initialization...', {
      redisUrlPrefix: redisUrl.substring(0, 30) + '...'
    });
  } else {
    // Development mode: Allow fallback but warn
    if ((!redisUrl || redisUrl === '') && (!redisHost || redisHost === '')) {
      logger.warn('⚠️ Redis not configured. Workers will not be initialized. Background jobs disabled.');
      logger.warn('⚠️ To enable workers, set REDIS_URL or REDIS_HOST environment variable.');
      logger.warn('⚠️ Skipping all worker initialization.');
      return;
    }

    // If REDIS_URL is provided in development, validate it
    if (redisUrl && redisUrl !== '') {
      if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
        logger.warn('⚠️ REDIS_URL format is invalid. Must start with redis:// or rediss://');
        logger.warn('⚠️ Skipping ALL worker initialization.');
        return;
      }
      logger.info('✅ Redis configuration found (development). Proceeding with worker initialization...', {
        redisUrlPrefix: redisUrl.substring(0, 20) + '...'
      });
    } else {
      logger.warn('⚠️ Using REDIS_HOST fallback (development only). This will NOT work in production.');
    }
  }

  try {
    logger.info('🚀 Initializing all job queue workers...');

    // CRITICAL: Verify Redis connection BEFORE creating any workers
    // This prevents BullMQ from defaulting to localhost
    const { getRedisConnection } = require('../services/jobQueueService');
    const redisConnection = getRedisConnection();


    if (!redisConnection || redisConnection === null || redisConnection === undefined) {
      const errorMsg = '❌ FATAL: getRedisConnection() returned null/undefined. Cannot create workers.';
      
      logger.error(errorMsg);
      logger.error('❌ Workers will NOT be initialized. Check REDIS_URL in Render.com.');
      return;
    }

    // In production, connection can be IORedis instance or string URL
    if (isProduction) {
      const isIORedisByName = redisConnection && typeof redisConnection === 'object' && redisConnection.constructor?.name === 'Redis';
      const isIORedisLike = redisConnection && typeof redisConnection === 'object' && redisConnection.options && (typeof redisConnection.connect === 'function' || redisConnection.status !== undefined);
      const isIORedis = isIORedisByName || isIORedisLike;
      const isString = typeof redisConnection === 'string';

      if (!isIORedis && !isString) {
        const errorMsg = '❌ FATAL: Redis connection is not IORedis instance or string in production. Cannot create workers.';
        
        
        logger.error(errorMsg);
        logger.error('❌ Connection type:', typeof redisConnection);
        logger.error('❌ Workers will NOT be initialized. REDIS_URL must be a valid Redis URL string.');
        return;
      }

      // If it's a string, check for localhost
      if (isString && (redisConnection.includes('127.0.0.1') || redisConnection.includes('localhost'))) {
        const errorMsg = '❌ FATAL: Redis connection string contains localhost. Cannot create workers.';
        
        
        logger.error(errorMsg);
        logger.error('❌ Connection contains localhost/127.0.0.1');
        logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service.');
        return;
      }

      // If it's an IORedis instance, check its options
      if (isIORedis) {
        const options = redisConnection.options || {};
        const host = options.host || options.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          const errorMsg = '❌ FATAL: IORedis instance has localhost host. Cannot create workers.';
          logger.error(errorMsg);
          logger.error('❌ IORedis instance contains localhost/127.0.0.1');
          logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service.');
          return;
        }
        
        logger.info('✅ IORedis instance validated', { host });
      }
    } else {
      // Development: Final check for localhost in connection string
      const connStr = typeof redisConnection === 'string' ? redisConnection : JSON.stringify(redisConnection);
      if (connStr.includes('127.0.0.1') || connStr.includes('localhost')) {
        logger.warn('⚠️ Redis connection contains localhost (development only)');
      }
    }

    
    logger.info('✅ Redis connection validated. Proceeding with worker creation...');

    // Import and initialize workers
    const { initializeVideoWorker } = require('./videoProcessor');
    const { initializeContentWorker } = require('./contentGenerator');
    const { initializeEmailWorker } = require('./emailSender');
    const { initializeTranscriptWorker } = require('./transcriptProcessor');
    const { initializeSocialPostWorker } = require('./socialPostProcessor');

    // Initialize each worker (they will check Redis internally)
    const videoWorker = initializeVideoWorker();
    const contentWorker = initializeContentWorker();
    const emailWorker = initializeEmailWorker();
    const transcriptWorker = initializeTranscriptWorker();
    const socialWorker = initializeSocialPostWorker();

    // Check if any workers were actually created
    const workersCreated = [videoWorker, contentWorker, emailWorker, transcriptWorker, socialWorker].filter(w => w !== null).length;

    if (workersCreated === 0) {
      logger.warn('⚠️ No workers were created. Redis may not be configured correctly.');
      return;
    }

    logger.info(`✅ ${workersCreated} workers created successfully`);

    logger.info('✅ All workers initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize workers', { error: error.message });
    logger.warn('⚠️ Background jobs will not be processed. Server will continue without workers.');
    // Don't throw - workers are optional
  }
}

/**
 * Gracefully shutdown all workers
 */
async function shutdownAllWorkers() {
  try {
    logger.info('🛑 Shutting down all workers...');
    const { closeAll } = require('../services/jobQueueService');
    await closeAll();
    logger.info('✅ All workers shut down');
  } catch (error) {
    logger.error('Error shutting down workers', { error: error.message });
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownAllWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownAllWorkers();
  process.exit(0);
});

module.exports = {
  initializeAllWorkers,
  shutdownAllWorkers,
};



