// Worker Initialization
// Central entry point for all workers

const logger = require('../utils/logger');

/**
 * Initialize all workers
 */
function initializeAllWorkers() {
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
    throw error;
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



