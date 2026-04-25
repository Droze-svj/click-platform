/**
 * Token Refresh Worker
 * Pulls from 'token-refresh' queue and executes proactive token rotation
 */

const { createWorker, addJob } = require('../services/jobQueueService');
const { refreshExpiringTokens } = require('../services/tokenRefreshService');
const logger = require('../utils/logger');

const QUEUE_NAME = 'token-refresh';

/**
 * Initialize the token refresh worker and register the recurring job
 */
function initializeTokenRefreshWorker() {
  const worker = createWorker(QUEUE_NAME, async (job) => {
    logger.info('Executing proactive token refresh job');
    return await refreshExpiringTokens();
  });

  if (worker) {
    logger.info('✅ Token Refresh Worker initialized');
    
    // Register recurring job (if not already registered)
    // Run every 6 hours
    addJob(QUEUE_NAME, { name: 'refresh-scan' }, {
      repeat: {
        pattern: '0 */6 * * *' // Every 6 hours
      },
      jobId: 'periodic-token-refresh' // Deterministic ID to prevent duplicates
    }).catch(err => {
      logger.error('Failed to register periodic token refresh job', { error: err.message });
    });
  }

  return worker;
}

module.exports = {
  initializeTokenRefreshWorker
};
