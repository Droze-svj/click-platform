// Collaboration Conflict Resolution Service

const Content = require('../models/Content');
const logger = require('../utils/logger');

// Store pending changes for conflict resolution
const pendingChanges = new Map(); // contentId -> Array of changes

/**
 * Handle concurrent edits with conflict resolution
 */
async function handleConcurrentEdit(contentId, userId, change, baseVersion) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const currentVersion = content.version || 0;

    // Check for conflicts
    if (baseVersion !== currentVersion) {
      // Conflict detected - need to merge
      logger.warn('Edit conflict detected', {
        contentId,
        userId,
        baseVersion,
        currentVersion,
      });

      // Store pending change
      if (!pendingChanges.has(contentId)) {
        pendingChanges.set(contentId, []);
      }

      pendingChanges.get(contentId).push({
        userId,
        change,
        baseVersion,
        timestamp: new Date(),
      });

      // Try to auto-merge if possible
      const merged = await attemptAutoMerge(contentId, change, content);
      
      if (merged.success) {
        return {
          success: true,
          merged: true,
          version: content.version,
          conflict: false,
        };
      }

      // Manual merge required
      return {
        success: false,
        merged: false,
        conflict: true,
        currentVersion: content.version,
        pendingChanges: pendingChanges.get(contentId),
      };
    }

    // No conflict - apply change
    await applyChange(content, change);
    content.version = (content.version || 0) + 1;
    await content.save();

    return {
      success: true,
      merged: false,
      conflict: false,
      version: content.version,
    };
  } catch (error) {
    logger.error('Handle concurrent edit error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Attempt automatic merge
 */
async function attemptAutoMerge(contentId, change, content) {
  try {
    // Simple merge strategy: if changes are in different parts of the document
    if (change.operation === 'insert' || change.operation === 'delete') {
      const currentText = content.transcript || content.text || '';
      const changeIndex = change.index || 0;

      // Check if change overlaps with pending changes
      const pending = pendingChanges.get(contentId) || [];
      const hasOverlap = pending.some(pendingChange => {
        const pendingIndex = pendingChange.change.index || 0;
        const distance = Math.abs(changeIndex - pendingIndex);
        return distance < 50; // Within 50 characters
      });

      if (!hasOverlap) {
        // No overlap - safe to auto-merge
        await applyChange(content, change);
        content.version = (content.version || 0) + 1;
        await content.save();

        // Clear pending changes for this content
        pendingChanges.delete(contentId);

        return { success: true };
      }
    }

    return { success: false, reason: 'overlap_detected' };
  } catch (error) {
    logger.error('Auto merge error', { error: error.message, contentId });
    return { success: false, reason: 'error' };
  }
}

/**
 * Apply change to content
 */
async function applyChange(content, change) {
  const currentText = content.transcript || content.text || '';

  if (change.operation === 'insert') {
    const newText =
      currentText.slice(0, change.index) +
      change.text +
      currentText.slice(change.index);
    content.transcript = newText;
    content.text = newText;
  } else if (change.operation === 'delete') {
    const newText =
      currentText.slice(0, change.index) +
      currentText.slice(change.index + change.length);
    content.transcript = newText;
    content.text = newText;
  } else if (change.operation === 'replace') {
    content.transcript = change.content;
    content.text = change.content;
  }
}

/**
 * Resolve conflict manually
 */
async function resolveConflict(contentId, userId, resolution) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Apply resolution
    if (resolution.content) {
      content.transcript = resolution.content;
      content.text = resolution.content;
    }

    content.version = (content.version || 0) + 1;
    await content.save();

    // Clear pending changes
    pendingChanges.delete(contentId);

    logger.info('Conflict resolved', { contentId, userId });
    return {
      success: true,
      version: content.version,
    };
  } catch (error) {
    logger.error('Resolve conflict error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Get conflict status
 */
function getConflictStatus(contentId) {
  const pending = pendingChanges.get(contentId) || [];
  return {
    hasConflict: pending.length > 0,
    pendingChanges: pending.length,
    changes: pending,
  };
}

module.exports = {
  handleConcurrentEdit,
  resolveConflict,
  getConflictStatus,
};






