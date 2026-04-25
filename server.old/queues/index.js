// Job Queue Manager
// Centralized queue management and initialization

const { getQueue, addJob, createWorker, getQueueStats } = require('../services/jobQueueService');
const logger = require('../utils/logger');

// Import worker initialization
const { initializeAllWorkers } = require('../workers');

// Queue names
const QUEUE_NAMES = {
  VIDEO_PROCESSING: 'video-processing',
  CONTENT_GENERATION: 'content-generation',
  EMAIL_SENDING: 'email-sending',
  TRANSCRIPT_GENERATION: 'transcript-generation',
  SOCIAL_POSTING: 'social-posting',
  ANALYTICS_PROCESSING: 'analytics-processing',
  FILE_PROCESSING: 'file-processing',
  SCHEDULED_POSTS: 'scheduled-posts',
};

// Job priorities
const JOB_PRIORITY = {
  CRITICAL: 10,
  HIGH: 5,
  NORMAL: 0,
  LOW: -5,
};

/**
 * Initialize all workers
 */
function initializeWorkers() {
  return initializeAllWorkers();
}

/**
 * Add video processing job
 */
async function addVideoProcessingJob(videoData, options = {}) {
  return addJob(QUEUE_NAMES.VIDEO_PROCESSING, {
    name: 'process-video',
    data: videoData,
  }, {
    priority: options.priority || JOB_PRIORITY.NORMAL,
    attempts: options.attempts || 3,
    ...options,
  });
}

/**
 * Add content generation job
 */
async function addContentGenerationJob(contentData, options = {}) {
  return addJob(QUEUE_NAMES.CONTENT_GENERATION, {
    name: 'generate-content',
    data: contentData,
  }, {
    priority: options.priority || JOB_PRIORITY.NORMAL,
    attempts: options.attempts || 2,
    ...options,
  });
}

/**
 * Add email sending job
 */
async function addEmailJob(emailData, options = {}) {
  return addJob(QUEUE_NAMES.EMAIL_SENDING, {
    name: 'send-email',
    data: emailData,
  }, {
    priority: options.priority || JOB_PRIORITY.HIGH,
    attempts: options.attempts || 3,
    ...options,
  });
}

/**
 * Add transcript generation job
 */
async function addTranscriptJob(transcriptData, options = {}) {
  return addJob(QUEUE_NAMES.TRANSCRIPT_GENERATION, {
    name: 'generate-transcript',
    data: transcriptData,
  }, {
    priority: options.priority || JOB_PRIORITY.NORMAL,
    attempts: options.attempts || 2,
    ...options,
  });
}

/**
 * Add social media posting job
 */
async function addSocialPostJob(postData, options = {}) {
  return addJob(QUEUE_NAMES.SOCIAL_POSTING, {
    name: 'post-to-social',
    data: postData,
  }, {
    priority: options.priority || JOB_PRIORITY.HIGH,
    attempts: options.attempts || 3,
    delay: options.delay || 0, // For scheduled posts
    ...options,
  });
}

/**
 * Add scheduled post job
 */
async function addScheduledPostJob(postData, scheduleTime, options = {}) {
  const delay = Math.max(0, new Date(scheduleTime).getTime() - Date.now());
  
  return addJob(QUEUE_NAMES.SCHEDULED_POSTS, {
    name: 'scheduled-post',
    data: postData,
  }, {
    priority: options.priority || JOB_PRIORITY.NORMAL,
    delay,
    attempts: options.attempts || 2,
    ...options,
  });
}

/**
 * Get all queue statistics
 */
async function getAllQueueStats() {
  const stats = {};
  
  for (const [key, queueName] of Object.entries(QUEUE_NAMES)) {
    try {
      stats[queueName] = await getQueueStats(queueName);
    } catch (error) {
      logger.warn('Failed to get stats for queue', { queue: queueName, error: error.message });
      stats[queueName] = { error: error.message };
    }
  }
  
  return stats;
}

/**
 * Clean all queues
 */
async function cleanAllQueues(grace = 5000) {
  const { cleanQueue } = require('../services/jobQueueService');
  
  for (const queueName of Object.values(QUEUE_NAMES)) {
    try {
      await cleanQueue(queueName, grace);
    } catch (error) {
      logger.warn('Failed to clean queue', { queue: queueName, error: error.message });
    }
  }
}

module.exports = {
  QUEUE_NAMES,
  JOB_PRIORITY,
  initializeWorkers,
  addVideoProcessingJob,
  addContentGenerationJob,
  addEmailJob,
  addTranscriptJob,
  addSocialPostJob,
  addScheduledPostJob,
  getAllQueueStats,
  cleanAllQueues,
};

