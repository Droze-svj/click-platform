// Transcript generation worker

const { createWorker } = require('../services/jobQueueService');
const { generateTranscript } = require('../services/whisperService');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Transcript generation job processor
 */
async function processTranscriptJob(jobData, job) {
  const { contentId, videoUrl, language, userId } = jobData;

  try {
    await job.updateProgress(0);
    logger.info('Starting transcript generation', { contentId, jobId: job.id });

    // Update content status
    await Content.findByIdAndUpdate(contentId, {
      $set: { 'processing.transcriptStatus': 'processing' }
    });

    // Generate transcript
    await job.updateProgress(25);
    const transcript = await generateTranscript(videoUrl, {
      language: language || 'en',
    });

    await job.updateProgress(75);

    // Save transcript to content
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        transcript: transcript.text,
        'processing.transcriptStatus': 'completed',
        'processing.transcriptCompletedAt': new Date(),
      }
    });

    await job.updateProgress(100);
    logger.info('Transcript generation completed', { contentId, jobId: job.id });

    return {
      success: true,
      contentId,
      transcriptLength: transcript.text?.length || 0,
    };
  } catch (error) {
    logger.error('Transcript generation failed', {
      contentId,
      jobId: job.id,
      error: error.message,
    });

    // Update content status
    await Content.findByIdAndUpdate(contentId, {
      $set: { 'processing.transcriptStatus': 'failed' }
    }).catch(() => {});

    captureException(error, {
      tags: { queue: 'transcript-generation', contentId },
    });

    throw error;
  }
}

/**
 * Initialize transcript worker
 */
function initializeTranscriptWorker() {
  const worker = createWorker('transcript-generation', processTranscriptJob, {
    concurrency: 3, // Process 3 transcripts concurrently
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute
    },
  });

  logger.info('Transcript generation worker initialized');
  return worker;
}

module.exports = {
  initializeTranscriptWorker,
  processTranscriptJob,
};



