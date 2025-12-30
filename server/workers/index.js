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
  
  if ((!redisUrl || redisUrl === '') && (!redisHost || redisHost === '')) {
    logger.warn('⚠️ Redis not configured. Workers will not be initialized. Background jobs disabled.');
    logger.warn('⚠️ To enable workers, set REDIS_URL environment variable in Render.com.');
    return;
  }
  
  // In production/staging, require REDIS_URL (not localhost fallback)
  if ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') && (!redisUrl || redisUrl === '')) {
    logger.error('⚠️ REDIS_URL is required in production/staging. Workers will not be initialized.');
    logger.error('⚠️ Add REDIS_URL to Render.com environment variables to enable workers.');
    return;
  }

  try {
    logger.info('🚀 Initializing all job queue workers...');

    // Import and initialize workers
    const { initializeVideoWorker } = require('./videoProcessor');
    const { initializeContentWorker } = require('./contentGenerator');
    const { initializeEmailWorker } = require('./emailSender');
    const { initializeTranscriptWorker } = require('./transcriptProcessor');
    const { initializeSocialPostWorker } = require('./socialPostProcessor');

    // Initialize each worker
    initializeVideoWorker();
    initializeContentWorker();
    initializeEmailWorker();
    initializeTranscriptWorker();
    initializeSocialPostWorker();

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



