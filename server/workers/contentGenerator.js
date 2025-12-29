// Content generation worker

const { createWorker } = require('../services/jobQueueService');
const { generateContentFromText } = require('../routes/content');
const { emitProcessingProgress, emitProcessingComplete, emitProcessingFailed } = require('../services/realtimeService');
const logger = require('../utils/logger');

/**
 * Content generation job processor
 */
async function processContentJob(jobData, job) {
  const { contentId, text, user, platforms } = jobData;
  const userId = user._id || user;

  try {
    await job.updateProgress(10);
    emitProcessingProgress(userId, job.id, 10, 'Starting content generation...');

    logger.info('Starting content generation', {
      contentId,
      jobId: job.id,
    });

    // Generate content
    await generateContentFromText(contentId, text, user, platforms);

    await job.updateProgress(100);
    emitProcessingComplete(userId, job.id, { success: true, contentId });
    
    logger.info('Content generation completed', {
      contentId,
      jobId: job.id,
    });

    return { success: true, contentId };
  } catch (error) {
    logger.error('Content generation job failed', {
      contentId,
      jobId: job.id,
      error: error.message,
    });
    
    emitProcessingFailed(userId, job.id, error);
    throw error;
  }
}

/**
 * Initialize content generation worker
 */
function initializeContentWorker() {
  const worker = createWorker('content-generation', processContentJob, {
    concurrency: 5, // Process 5 content items concurrently
    limiter: {
      max: 20,
      duration: 60000, // Max 20 jobs per minute
    },
  });

  logger.info('Content generation worker initialized');
  return worker;
}

module.exports = {
  initializeContentWorker,
  processContentJob,
};

