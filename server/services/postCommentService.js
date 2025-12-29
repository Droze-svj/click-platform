// Post Comment Service
// Commenting system for posts

const PostComment = require('../models/PostComment');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const ClientPortalUser = require('../models/ClientPortalUser');
const logger = require('../utils/logger');

/**
 * Add comment to post
 */
async function addComment(postId, userId, commentData) {
  try {
    const {
      text,
      type = 'comment',
      parentCommentId = null,
      mentions = [],
      inlineComment = null,
      attachments = [],
      isInternal = false
    } = commentData;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if user is portal user or regular user
    let portalUserId = null;
    const portalUser = await ClientPortalUser.findOne({ userId });
    if (portalUser) {
      portalUserId = portalUser._id;
    }

    const comment = new PostComment({
      postId,
      contentId: post.contentId,
      userId,
      portalUserId,
      text,
      type,
      parentCommentId,
      mentions,
      inlineComment: inlineComment || { enabled: false },
      attachments,
      isInternal
    });

    await comment.save();

    // Notify mentioned users
    if (mentions.length > 0) {
      const notificationService = require('./notificationService');
      for (const mentionedUserId of mentions) {
        await notificationService.sendNotification(mentionedUserId, {
          type: 'comment_mention',
          title: 'You were mentioned in a comment',
          message: `${comment.text.substring(0, 100)}...`,
          link: `/posts/${postId}#comment-${comment._id}`
        });
      }
    }

    logger.info('Comment added', { commentId: comment._id, postId });
    return comment;
  } catch (error) {
    logger.error('Error adding comment', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get comments for post
 */
async function getPostComments(postId, filters = {}) {
  try {
    const {
      includeInternal = false,
      includeResolved = true,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const query = { postId, deletedAt: null };
    if (!includeInternal) {
      query.isInternal = false;
    }
    if (!includeResolved) {
      query.resolved = false;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const comments = await PostComment.find(query)
      .populate('userId', 'name email')
      .populate('portalUserId', 'name email')
      .populate('parentCommentId')
      .populate('mentions', 'name email')
      .populate('resolvedBy', 'name email')
      .sort(sort)
      .lean();

    // Organize into threads
    const threads = organizeCommentsIntoThreads(comments);

    return {
      comments,
      threads,
      total: comments.length,
      unresolved: comments.filter(c => !c.resolved).length
    };
  } catch (error) {
    logger.error('Error getting comments', { error: error.message, postId });
    throw error;
  }
}

/**
 * Organize comments into threads
 */
function organizeCommentsIntoThreads(comments) {
  const threads = [];
  const commentMap = new Map();

  // Create map of all comments
  comments.forEach(comment => {
    commentMap.set(comment._id.toString(), { ...comment, replies: [] });
  });

  // Build thread structure
  comments.forEach(comment => {
    if (comment.parentCommentId) {
      const parent = commentMap.get(comment.parentCommentId.toString());
      if (parent) {
        parent.replies.push(commentMap.get(comment._id.toString()));
      }
    } else {
      threads.push(commentMap.get(comment._id.toString()));
    }
  });

  return threads;
}

/**
 * Resolve comment
 */
async function resolveComment(commentId, userId) {
  try {
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    comment.resolved = true;
    comment.resolvedBy = userId;
    comment.resolvedAt = new Date();
    await comment.save();

    logger.info('Comment resolved', { commentId, userId });
    return comment;
  } catch (error) {
    logger.error('Error resolving comment', { error: error.message, commentId });
    throw error;
  }
}

/**
 * Add reaction to comment
 */
async function addReaction(commentId, userId, reactionType) {
  try {
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Remove existing reaction from this user
    comment.reactions = comment.reactions.filter(r => r.userId.toString() !== userId.toString());

    // Add new reaction
    comment.reactions.push({
      userId,
      type: reactionType,
      createdAt: new Date()
    });

    await comment.save();
    return comment;
  } catch (error) {
    logger.error('Error adding reaction', { error: error.message, commentId });
    throw error;
  }
}

/**
 * Edit comment
 */
async function editComment(commentId, userId, newText) {
  try {
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new Error('Not authorized to edit this comment');
    }

    comment.text = newText;
    comment.editedAt = new Date();
    await comment.save();

    return comment;
  } catch (error) {
    logger.error('Error editing comment', { error: error.message, commentId });
    throw error;
  }
}

/**
 * Delete comment
 */
async function deleteComment(commentId, userId) {
  try {
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new Error('Not authorized to delete this comment');
    }

    comment.deletedAt = new Date();
    await comment.save();

    return comment;
  } catch (error) {
    logger.error('Error deleting comment', { error: error.message, commentId });
    throw error;
  }
}

module.exports = {
  addComment,
  getPostComments,
  resolveComment,
  addReaction,
  editComment,
  deleteComment
};


