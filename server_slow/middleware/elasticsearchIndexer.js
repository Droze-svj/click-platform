// Elasticsearch Indexing Middleware

const { indexDocument, updateDocument, deleteDocument, isEnabled } = require('../services/elasticsearchService');
const logger = require('../utils/logger');

/**
 * Index content after save
 */
async function indexContent(content) {
  if (!isEnabled()) return;

  try {
    await indexDocument('content', content._id.toString(), {
      userId: content.userId.toString(),
      title: content.title || '',
      description: content.description || '',
      transcript: content.transcript || '',
      type: content.type,
      status: content.status,
      tags: content.tags || [],
      category: content.category || 'general',
      createdAt: content.createdAt,
      updatedAt: content.updatedAt || content.createdAt,
    });
  } catch (error) {
    logger.error('Error indexing content', {
      contentId: content._id,
      error: error.message,
    });
  }
}

/**
 * Update content index
 */
async function updateContentIndex(content) {
  if (!isEnabled()) return;

  try {
    await updateDocument('content', content._id.toString(), {
      userId: content.userId.toString(),
      title: content.title || '',
      description: content.description || '',
      transcript: content.transcript || '',
      type: content.type,
      status: content.status,
      tags: content.tags || [],
      category: content.category || 'general',
      updatedAt: content.updatedAt || new Date(),
    });
  } catch (error) {
    logger.error('Error updating content index', {
      contentId: content._id,
      error: error.message,
    });
  }
}

/**
 * Delete content from index
 */
async function deleteContentIndex(contentId) {
  if (!isEnabled()) return;

  try {
    await deleteDocument('content', contentId.toString());
  } catch (error) {
    logger.error('Error deleting content index', {
      contentId,
      error: error.message,
    });
  }
}

module.exports = {
  indexContent,
  updateContentIndex,
  deleteContentIndex,
};






