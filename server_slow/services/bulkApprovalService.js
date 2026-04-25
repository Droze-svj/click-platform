// Bulk Approval Service
// Bulk approval operations

const ContentApproval = require('../models/ContentApproval');
const { advanceToNextStage } = require('./multiStepWorkflowService');
const logger = require('../utils/logger');

/**
 * Bulk approve
 */
async function bulkApprove(approvalIds, userId, comment = '') {
  try {
    const results = {
      total: approvalIds.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const approvalId of approvalIds) {
      try {
        await advanceToNextStage(approvalId, userId, 'approve', comment);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          approvalId,
          error: error.message
        });
        logger.warn('Bulk approve failed for approval', { approvalId, error: error.message });
      }
    }

    logger.info('Bulk approval completed', { ...results, userId });
    return results;
  } catch (error) {
    logger.error('Error in bulk approval', { error: error.message, userId });
    throw error;
  }
}

/**
 * Bulk reject
 */
async function bulkReject(approvalIds, userId, reason = '') {
  try {
    const results = {
      total: approvalIds.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const approvalId of approvalIds) {
      try {
        await advanceToNextStage(approvalId, userId, 'reject', reason);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          approvalId,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in bulk reject', { error: error.message, userId });
    throw error;
  }
}

/**
 * Bulk request changes
 */
async function bulkRequestChanges(approvalIds, userId, changes = '') {
  try {
    const results = {
      total: approvalIds.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const approvalId of approvalIds) {
      try {
        await advanceToNextStage(approvalId, userId, 'request_changes', changes);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          approvalId,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in bulk request changes', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  bulkApprove,
  bulkReject,
  bulkRequestChanges
};


