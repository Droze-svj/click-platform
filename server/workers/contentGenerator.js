// Content generation worker

const { createWorker } = require('../services/jobQueueService');
const { generateContentFromText } = require('../services/contentGenerationService');
const { emitProcessingProgress, emitProcessingComplete, emitProcessingFailed } = require('../services/realtimeService');
const logger = require('../utils/logger');

/**
 * Content generation job processor
 */
async function processContentJob(jobData, job) {
  const { contentId, text, user, platforms } = jobData;
  const userId = user?._id || user;

  const onProgress = (percent, message) => {
    job.updateProgress(percent).catch((err) => logger.warn('Failed to update job progress', { jobId: job.id, percent, error: err.message }));
    emitProcessingProgress(userId, job.id, percent, message);
  };

  try {
    onProgress(10, 'Starting content generation...');
    logger.info('Starting content generation', { contentId, jobId: job.id });

    const outcome = await generateContentFromText(contentId, text, user, platforms, onProgress);

    // Generation ran but produced nothing (AI unavailable or over quota). The
    // content is already marked failed with the reason; report the job the same
    // way. Returned rather than thrown: a throw makes the queue retry the job
    // against the same exhausted quota.
    if (outcome && outcome.generated === false) {
      logger.warn('Content generation produced nothing', { contentId, jobId: job.id, reason: outcome.reason });
      emitProcessingFailed(userId, job.id, new Error(outcome.reason));
      return { success: false, contentId, reason: outcome.reason };
    }

    onProgress(100, 'Complete');
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

