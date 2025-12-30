// Worker Initialization
// Central entry point for all workers

const logger = require('../utils/logger');

/**
 * Initialize all workers
 */
function initializeAllWorkers() {
  // Skip workers if Redis is not configured (validate non-empty strings)
  const redisUrl = process.env.REDIS_URL?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();
  
  // Log what we're checking
  logger.info('🔍 Checking Redis configuration for workers...', {
    hasRedisUrl: !!redisUrl,
    hasRedisHost: !!redisHost,
    nodeEnv: process.env.NODE_ENV
  });
  
  if ((!redisUrl || redisUrl === '') && (!redisHost || redisHost === '')) {
    logger.warn('⚠️ Redis not configured. Workers will not be initialized. Background jobs disabled.');
    logger.warn('⚠️ To enable workers, set REDIS_URL environment variable in Render.com.');
    logger.warn('⚠️ Skipping all worker initialization.');
    return;
  }
  
  // In production/staging, require REDIS_URL (not localhost fallback)
  if ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') && (!redisUrl || redisUrl === '')) {
    logger.error('⚠️ REDIS_URL is required in production/staging. Workers will not be initialized.');
    logger.error('⚠️ Add REDIS_URL to Render.com environment variables to enable workers.');
    logger.warn('⚠️ Skipping all worker initialization.');
    return;
  }
  
  // Double-check: If we don't have a valid Redis URL, don't initialize
  if (!redisUrl || redisUrl === '') {
    logger.warn('⚠️ REDIS_URL is empty or invalid. Workers will not be initialized.');
    logger.warn('⚠️ Skipping ALL worker initialization to prevent localhost connections.');
    return;
  }
  
  // Triple-check: Ensure REDIS_URL is a valid connection string
  if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    logger.warn('⚠️ REDIS_URL format is invalid. Must start with redis:// or rediss://');
    logger.warn('⚠️ Skipping ALL worker initialization.');
    return;
  }
  
  logger.info('✅ Redis configuration found. Proceeding with worker initialization...', {
    redisUrlPrefix: redisUrl.substring(0, 20) + '...'
  });

  try {
    logger.info('🚀 Initializing all job queue workers...');

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



