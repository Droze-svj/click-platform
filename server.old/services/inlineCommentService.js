// Inline Comment Service
// Enhanced inline comments on posts

const Comment = require('../models/Comment');
const PostComment = require('../models/PostComment');
const logger = require('../utils/logger');

/**
 * Add inline comment to post
 */
async function addInlineComment(postId, commentData) {
  try {
    const {
      userId,
      text,
      type = 'comment',
      parentId = null,
      mentions = [],
      selectedText = null,
      lineNumber = null,
      position = null, // { x, y } for visual positioning
      attachments = [],
      internal = false
    } = commentData;

    // Check if PostComment model exists, otherwise use Comment
    let CommentModel;
    try {
      CommentModel = require('../models/PostComment');
    } catch (e) {
      CommentModel = Comment;
    }

    const comment = new CommentModel({
      postId,
      userId,
      text,
      type,
      parentId,
      mentions,
      selectedText,
      lineNumber,
      position,
      attachments,
      internal,
      resolved: false
    });

    await comment.save();

    logger.info('Inline comment added', { postId, commentId: comment._id });
    return comment;
  } catch (error) {
    logger.error('Error adding inline comment', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get inline comments for post
 */
async function getInlineComments(postId, filters = {}) {
  try {
    let CommentModel;
    try {
      CommentModel = require('../models/PostComment');
    } catch (e) {
      CommentModel = Comment;
    }

    const query = { postId };
    if (filters.resolved !== undefined) {
      query.resolved = filters.resolved;
    }
    if (filters.internal !== undefined) {
      query.internal = filters.internal;
    }

    const comments = await CommentModel.find(query)
      .populate('userId', 'name email avatar')
      .populate('parentId')
      .sort({ createdAt: 1 })
      .lean();

    // Organize into threads
    const threads = [];
    const commentMap = {};

    comments.forEach(comment => {
      commentMap[comment._id] = {
        ...comment,
        replies: []
      };
    });

    comments.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap[comment.parentId];
        if (parent) {
          parent.replies.push(commentMap[comment._id]);
        }
      } else {
        threads.push(commentMap[comment._id]);
      }
    });

    return {
      threads,
      total: comments.length,
      byPosition: comments.filter(c => c.position || c.lineNumber)
    };
  } catch (error) {
    logger.error('Error getting inline comments', { error: error.message, postId });
    throw error;
  }
}

/**
 * Resolve inline comment
 */
async function resolveInlineComment(commentId, userId) {
  try {
    let CommentModel;
    try {
      CommentModel = require('../models/PostComment');
    } catch (e) {
      CommentModel = Comment;
    }

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    comment.resolved = true;
    comment.resolvedBy = userId;
    comment.resolvedAt = new Date();
    await comment.save();

    logger.info('Inline comment resolved', { commentId, userId });
    return comment;
  } catch (error) {
    logger.error('Error resolving inline comment', { error: error.message, commentId });
    throw error;
  }
}

module.exports = {
  addInlineComment,
  getInlineComments,
  resolveInlineComment
};


