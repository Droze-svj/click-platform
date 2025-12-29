// Version Restore Service
// Restore posts to previous versions

const PostVersion = require('../models/PostVersion');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const { createPostVersion } = require('./multiStepWorkflowService');
const logger = require('../utils/logger');

/**
 * Restore post to previous version
 */
async function restorePostVersion(postId, versionNumber, userId, reason = '') {
  try {
    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Get version to restore
    const version = await PostVersion.findOne({ postId, versionNumber: parseInt(versionNumber) });
    if (!version) {
      throw new Error('Version not found');
    }

    // Create new version from current state (before restore)
    await createPostVersion(postId, post.contentId, userId, {
      changeReason: `Before restore to version ${versionNumber}`,
      content: post.content,
      metadata: {
        platform: post.platform,
        scheduledTime: post.scheduledTime
      }
    });

    // Restore content
    post.content = {
      text: version.content.text,
      mediaUrl: version.content.mediaUrl,
      hashtags: version.content.hashtags || [],
      mentions: version.content.mentions || []
    };

    await post.save();

    // Create new version for the restore
    await createPostVersion(postId, post.contentId, userId, {
      changeReason: reason || `Restored to version ${versionNumber}`,
      content: post.content,
      metadata: {
        platform: post.platform,
        scheduledTime: post.scheduledTime,
        restoredFrom: versionNumber
      }
    });

    logger.info('Post version restored', { postId, versionNumber, userId });
    return post;
  } catch (error) {
    logger.error('Error restoring post version', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get version restore history
 */
async function getVersionRestoreHistory(postId) {
  try {
    const versions = await PostVersion.find({ postId })
      .populate('createdBy', 'name email')
      .sort({ versionNumber: -1 })
      .lean();

    const restoreHistory = versions
      .filter(v => v.metadata?.restoredFrom)
      .map(v => ({
        versionNumber: v.versionNumber,
        restoredFrom: v.metadata.restoredFrom,
        restoredAt: v.createdAt,
        restoredBy: v.createdBy,
        reason: v.changeReason
      }));

    return restoreHistory;
  } catch (error) {
    logger.error('Error getting restore history', { error: error.message, postId });
    throw error;
  }
}

module.exports = {
  restorePostVersion,
  getVersionRestoreHistory
};


