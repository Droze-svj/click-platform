// Content generation from long-form (optional).
// Used by crossClientTemplateService and gapFillingService; stub when not fully implemented.

const logger = require('../utils/logger');

/**
 * Generate social posts from long-form content.
 * @param {Object} content - Content document
 * @param {Object} options - { platform, format, ... }
 * @returns {Promise<Object>} { success, posts?, message? }
 */
async function generateContentFromLongForm(content, options = {}) {
  try {
    logger.debug('Content generation stub: generateContentFromLongForm', {
      platform: options?.platform,
      contentId: content?._id || content?.id
    });
    return { success: false, message: 'Service not available' };
  } catch (err) {
    logger.warn('generateContentFromLongForm error', { error: err.message });
    return { success: false, message: err.message || 'Service not available' };
  }
}

/**
 * Generate content for gap-filling (e.g. platform, format, topic).
 * @param {Object} context - Gap context
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} { success, content?, message? }
 */
async function generateContent(context, options = {}) {
  try {
    logger.debug('Content generation stub: generateContent', {
      category: context?.category,
      clientWorkspaceId: context?.clientWorkspaceId
    });
    return { success: false, message: 'Service not available' };
  } catch (err) {
    logger.warn('generateContent error', { error: err.message });
    return { success: false, message: err.message || 'Service not available' };
  }
}

module.exports = {
  generateContentFromLongForm,
  generateContent
};
