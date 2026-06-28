// Transcript generation worker - Unified with aiTranscriptionService
const { createWorker } = require('../services/jobQueueService');
const { transcribeVideo: realTranscribe } = require('../services/aiTranscriptionService');
const Content = require('../models/Content');
const captionStore = require('../services/captionStore');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Transcript generation job processor
 */
async function processTranscriptJob(jobData, job) {
  const { contentId, videoUrl, language, userId } = jobData;

  try {
    await job.updateProgress(10);
    logger.info('Starting transcript generation via worker', { contentId, jobId: job.id, userId });

    // Update content status
    await Content.findByIdAndUpdate(contentId, {
      $set: { 'processing.transcriptStatus': 'processing' }
    });

    // Generate transcript using the unified service
    await job.updateProgress(30);
    const transResult = await realTranscribe(userId || 'system', contentId, videoUrl, {
      language: language || 'en',
    });

    if (!transResult.success) {
      throw new Error(`Transcription failed: provider ${transResult.provider} could not process`);
    }

    await job.updateProgress(80);

    // Heavy word-level data → Caption collection (off Content, no 16MB risk).
    await captionStore.saveSource(contentId, {
      text: transResult.text,
      words: transResult.words || [],
      language: transResult.language,
    }, { embedSlim: false });
    // Slim marker + processing status stay embedded on Content.
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        transcript: transResult.text,
        'captions.text': transResult.text,
        'captions.language': transResult.language,
        'processing.transcriptStatus': 'completed',
        'processing.transcriptCompletedAt': new Date(),
      }
    });

    await job.updateProgress(100);
    logger.info('Transcript generation completed by worker', { contentId, jobId: job.id, provider: transResult.provider });

    return {
      success: true,
      contentId,
      transcriptLength: transResult.text?.length || 0,
      provider: transResult.provider
    };
  } catch (error) {
    logger.error('Transcript generation failed in worker', {
      contentId,
      jobId: job.id,
      error: error.message,
    });

    // Update content status. Don't crash the worker on a secondary DB failure,
    // but log it — silently swallowing made transcript orphans invisible.
    await Content.findByIdAndUpdate(contentId, {
      $set: { 'processing.transcriptStatus': 'failed' }
    }).catch((updateErr) => {
      logger.error('Failed to mark transcript status as failed', {
        contentId,
        jobId: job.id,
        error: updateErr.message,
      });
    });

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

  logger.info('Transcript generation worker initialized (Unified Path)');
  return worker;
}

module.exports = {
  initializeTranscriptWorker,
  processTranscriptJob,
};
