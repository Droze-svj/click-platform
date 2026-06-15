// Bulk Operations Service

const User = require('../models/User');
const Content = require('../models/Content');
const { jobQueueService } = require('./jobQueueService');
const logger = require('../utils/logger');

/**
 * Bulk update users
 */
// Privilege/identity fields that must NEVER be settable through the bulk path —
// even an admin changes these via the dedicated, audited per-user routes, so a
// compromised/low-trust admin token can't mass-escalate. (Mongo operator keys
// like `$where` are stripped too.)
const BULK_USER_BLOCKED_FIELDS = new Set([
  'role', 'permissions', 'isAdmin', 'subscription', 'membershipPackage', 'tier',
  'email', 'password', 'passwordHash', '_id',
]);

async function bulkUpdateUsers(userIds, updates) {
  try {
    const safeUpdates = {};
    for (const [k, v] of Object.entries(updates || {})) {
      if (!BULK_USER_BLOCKED_FIELDS.has(k) && !k.startsWith('$')) safeUpdates[k] = v;
    }
    if (Object.keys(safeUpdates).length === 0) {
      logger.warn('Bulk update users: no permitted fields after blocklist', { requested: Object.keys(updates || {}) });
      return { success: true, modified: 0, matched: 0 };
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: safeUpdates }
    );

    logger.info('Bulk users updated', {
      count: result.modifiedCount,
      updates: Object.keys(safeUpdates),
    });

    return {
      success: true,
      modified: result.modifiedCount,
      matched: result.matchedCount,
    };
  } catch (error) {
    logger.error('Bulk update users error', { error: error.message });
    throw error;
  }
}

/**
 * Bulk delete users
 */
async function bulkDeleteUsers(userIds, softDelete = true) {
  try {
    if (softDelete) {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      );

      logger.info('Bulk users soft deleted', { count: result.modifiedCount });
      return {
        success: true,
        deleted: result.modifiedCount,
        method: 'soft',
      };
    } else {
      const result = await User.deleteMany({ _id: { $in: userIds } });
      logger.info('Bulk users hard deleted', { count: result.deletedCount });
      return {
        success: true,
        deleted: result.deletedCount,
        method: 'hard',
      };
    }
  } catch (error) {
    logger.error('Bulk delete users error', { error: error.message });
    throw error;
  }
}

/**
 * Bulk update content
 */
async function bulkUpdateContent(contentIds, updates) {
  try {
    const result = await Content.updateMany(
      { _id: { $in: contentIds } },
      { $set: updates }
    );

    logger.info('Bulk content updated', {
      count: result.modifiedCount,
      updates: Object.keys(updates),
    });

    return {
      success: true,
      modified: result.modifiedCount,
      matched: result.matchedCount,
    };
  } catch (error) {
    logger.error('Bulk update content error', { error: error.message });
    throw error;
  }
}

/**
 * Bulk delete content
 */
async function bulkDeleteContent(contentIds) {
  try {
    // Process in background job for large batches
    if (contentIds.length > 100) {
      await jobQueueService.add('bulk-delete-content', {
        contentIds,
      }, {
        priority: 5,
      });

      return {
        success: true,
        queued: true,
        message: 'Bulk delete queued for processing',
      };
    }

    const result = await Content.deleteMany({ _id: { $in: contentIds } });
    logger.info('Bulk content deleted', { count: result.deletedCount });

    return {
      success: true,
      deleted: result.deletedCount,
    };
  } catch (error) {
    logger.error('Bulk delete content error', { error: error.message });
    throw error;
  }
}

/**
 * Bulk export data
 */
async function bulkExportData(userIds, format = 'json') {
  try {
    // Process in background job
    await jobQueueService.add('bulk-export-data', {
      userIds,
      format,
    }, {
      priority: 3,
    });

    return {
      success: true,
      queued: true,
      message: 'Export queued for processing',
    };
  } catch (error) {
    logger.error('Bulk export data error', { error: error.message });
    throw error;
  }
}

module.exports = {
  bulkUpdateUsers,
  bulkDeleteUsers,
  bulkUpdateContent,
  bulkDeleteContent,
  bulkExportData,
};






