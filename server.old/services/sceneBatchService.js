// Scene Batch Processing Service
// Process multiple videos for scene detection

const { detectScenes } = require('./sceneDetectionService');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Batch detect scenes for multiple videos
 */
async function batchDetectScenes(contentIds, userId, options = {}) {
  try {
    const {
      sensitivity = 0.3,
      minSceneLength = 1.0,
      fps = 3,
      extractMetadata = true,
      onProgress = null,
      concurrency = 3
    } = options;

    const results = [];
    const errors = [];

    // Process in batches to control concurrency
    for (let i = 0; i < contentIds.length; i += concurrency) {
      const batch = contentIds.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (contentId, index) => {
        try {
          // Verify content ownership
          const content = await Content.findById(contentId);
          if (!content || content.userId.toString() !== userId.toString()) {
            throw new Error(`Content ${contentId} not found or access denied`);
          }

          // Detect scenes
          const result = await detectScenes(contentId, {
            sensitivity,
            minSceneLength,
            fps,
            extractMetadata,
            userId
          });

          if (onProgress) {
            onProgress({
              contentId,
              status: 'completed',
              progress: ((i + index + 1) / contentIds.length) * 100,
              result
            });
          }

          return {
            contentId,
            success: true,
            result
          };
        } catch (error) {
          logger.error('Error in batch scene detection', { contentId, error: error.message });
          captureException(error, {
            tags: { service: 'scene_batch', contentId }
          });

          if (onProgress) {
            onProgress({
              contentId,
              status: 'failed',
              progress: ((i + index + 1) / contentIds.length) * 100,
              error: error.message
            });
          }

          return {
            contentId,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Separate successes and errors
      batchResults.forEach(r => {
        if (r.success) {
          results.push(r);
        } else {
          errors.push(r);
        }
      });
    }

    const summary = {
      total: contentIds.length,
      successful: results.filter(r => r.success).length,
      failed: errors.length,
      results: results.filter(r => r.success),
      errors
    };

    logger.info('Batch scene detection completed', summary);
    return summary;
  } catch (error) {
    logger.error('Error in batch scene detection', { error: error.message });
    throw error;
  }
}

/**
 * Batch apply template to multiple videos
 */
async function batchApplyTemplate(templateName, contentIds, userId) {
  try {
    const { applyTemplate } = require('./sceneTemplateService');
    
    const results = [];
    const errors = [];

    for (const contentId of contentIds) {
      try {
        const result = await applyTemplate(templateName, contentId, userId);
        results.push({ contentId, success: true, result });
      } catch (error) {
        logger.error('Error applying template in batch', { contentId, error: error.message });
        errors.push({ contentId, success: false, error: error.message });
      }
    }

    return {
      total: contentIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  } catch (error) {
    logger.error('Error in batch template application', { error: error.message });
    throw error;
  }
}

module.exports = {
  batchDetectScenes,
  batchApplyTemplate
};







