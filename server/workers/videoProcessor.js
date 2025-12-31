// Video processing worker

const { createWorker } = require('../services/jobQueueService');
const { processVideo } = require('../routes/video');
const { emitProcessingProgress, emitProcessingComplete, emitProcessingFailed } = require('../services/realtimeService');
const logger = require('../utils/logger');

/**
 * Video processing job processor
 */
async function processVideoJob(jobData, job) {
  const { contentId, videoPath, user } = jobData;
  const userId = user._id || user;

  try {
    // Update job progress and emit real-time update
    await job.updateProgress(10);
    emitProcessingProgress(userId, job.id, 10, 'Starting video processing...');

    logger.info('Starting video processing', {
      contentId,
      jobId: job.id,
    });

    // Process video
    await processVideo(contentId, videoPath, user);

    await job.updateProgress(100);
    emitProcessingComplete(userId, job.id, { success: true, contentId });
    
    logger.info('Video processing completed', {
      contentId,
      jobId: job.id,
    });

    return { success: true, contentId };
  } catch (error) {
    logger.error('Video processing job failed', {
      contentId,
      jobId: job.id,
      error: error.message,
    });
    
    emitProcessingFailed(userId, job.id, error);
    throw error;
  }
}

/**
 * Initialize video processing worker
 */
function initializeVideoWorker() {
  console.log('[initializeVideoWorker] Starting worker initialization');
  logger.info('[initializeVideoWorker] Starting worker initialization', {
    nodeEnv: process.env.NODE_ENV,
    redisUrlExists: !!process.env.REDIS_URL,
    redisUrlLength: process.env.REDIS_URL?.length || 0
  });
  
  const worker = createWorker('video-processing', processVideoJob, {
    concurrency: 2, // Process 2 videos concurrently
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute
    },
  });

  console.log(`[initializeVideoWorker] Worker result: ${worker ? 'created' : 'null'}`);
  logger.info('Video processing worker initialized', { workerCreated: !!worker });
  return worker;
}

module.exports = {
  initializeVideoWorker,
  processVideoJob,
};

