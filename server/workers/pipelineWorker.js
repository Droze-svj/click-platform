/**
 * Pipeline Worker
 * Processes unified content pipeline jobs in the background
 */

const { createWorker } = require('../services/jobQueueService');
const { QUEUE_NAMES } = require('../queues');
const { processContentPipeline } = require('../services/unifiedContentPipelineService');
const logger = require('../utils/logger');
const Content = require('../models/Content');

/**
 * Initialize pipeline worker
 */
function initializePipelineWorker() {
  return createWorker(QUEUE_NAMES.PIPELINE_PROCESSING, async (job) => {
    const { userId, contentId, options } = job.data;
    
    logger.info(`[PipelineWorker] Starting job ${job.id}`, { userId, contentId });
    
    try {
      // Ensure content exists and is valid
      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error(`Content ${contentId} not found`);
      }

      // Update content status to processing
      await Content.findByIdAndUpdate(contentId, { 
        'pipeline.status': 'processing',
        'pipeline.startedAt': new Date()
      });

      // Run the pipeline
      const result = await processContentPipeline(userId, contentId, options);
      
      logger.info(`[PipelineWorker] Job ${job.id} completed`, { userId, contentId });
      return result;
    } catch (error) {
      logger.error(`[PipelineWorker] Job ${job.id} failed`, { 
        userId, 
        contentId, 
        error: error.message 
      });
      
      // Update content status to failed
      await Content.findByIdAndUpdate(contentId, { 
        'pipeline.status': 'failed',
        'pipeline.error': error.message
      });
      
      throw error;
    }
  }, {
    concurrency: 2 // Allow 2 simultaneous pipeline runs per worker instance
  });
}

module.exports = {
  initializePipelineWorker
};
