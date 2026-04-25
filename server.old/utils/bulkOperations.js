// Bulk operations utilities

const logger = require('./logger');

/**
 * Bulk update with error handling
 */
async function bulkUpdate(Model, operations, options = {}) {
  const {
    ordered = false,
    onError = null
  } = options;

  try {
    const result = await Model.bulkWrite(operations, { ordered });
    
    logger.info('Bulk update completed', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });

    return {
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    };
  } catch (error) {
    logger.error('Bulk update error', { error: error.message });
    
    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Bulk insert with error handling
 */
async function bulkInsert(Model, documents, options = {}) {
  const {
    ordered = false,
    onError = null
  } = options;

  try {
    const result = await Model.insertMany(documents, { ordered });
    
    logger.info('Bulk insert completed', {
      inserted: result.length
    });

    return {
      success: true,
      inserted: result.length,
      documents: result
    };
  } catch (error) {
    logger.error('Bulk insert error', { error: error.message });
    
    if (onError) {
      onError(error);
    }

    // Return partial success if ordered is false
    if (!ordered && error.writeErrors) {
      return {
        success: false,
        inserted: error.insertedCount || 0,
        errors: error.writeErrors
      };
    }

    throw error;
  }
}

/**
 * Bulk delete with error handling
 */
async function bulkDelete(Model, filter, options = {}) {
  try {
    const result = await Model.deleteMany(filter);
    
    logger.info('Bulk delete completed', {
      deleted: result.deletedCount
    });

    return {
      success: true,
      deleted: result.deletedCount
    };
  } catch (error) {
    logger.error('Bulk delete error', { error: error.message });
    throw error;
  }
}

module.exports = {
  bulkUpdate,
  bulkInsert,
  bulkDelete
};







