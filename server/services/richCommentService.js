// Rich Comment Service
// Enhanced comments with rich text, templates, reactions

const PostComment = require('../models/PostComment');
const CommentTemplate = require('../models/CommentTemplate');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Add rich text comment
 */
async function addRichComment(postId, commentData) {
  try {
    const {
      userId,
      text,
      richText = null, // HTML or markdown
      type = 'comment',
      parentId = null,
      mentions = [],
      selectedText = null,
      lineNumber = null,
      position = null,
      attachments = [],
      templateId = null, // Use template
      reactions = [],
      isInternal = false
    } = commentData;

    // If template is used, get template text
    let finalText = text;
    if (templateId) {
      const template = await CommentTemplate.findById(templateId);
      if (template) {
        finalText = template.text;
        // Update template usage
        template.usageCount++;
        template.lastUsed = new Date();
        await template.save();
      }
    }

    const comment = new PostComment({
      postId,
      userId,
      text: finalText,
      richText,
      type,
      parentId,
      mentions,
      inlineComment: {
        enabled: lineNumber !== null || selectedText !== null,
        lineNumber,
        selectedText,
        position
      },
      attachments,
      reactions,
      isInternal,
      resolved: false
    });

    await comment.save();

    // Notify mentioned users
    if (mentions.length > 0) {
      for (const mentionedId of mentions) {
        try {
          await NotificationService.notifyUser(mentionedId.toString(), {
            type: 'comment_mention',
            title: 'You were mentioned in a comment',
            message: `${comment.text.substring(0, 100)}...`,
            data: {
              commentId: comment._id,
              postId
            }
          });
        } catch (error) {
          logger.warn('Error notifying mentioned user', { mentionedId, error: error.message });
        }
      }
    }

    logger.info('Rich comment added', { postId, commentId: comment._id });
    return comment;
  } catch (error) {
    logger.error('Error adding rich comment', { error: error.message, postId });
    throw error;
  }
}

/**
 * Add reaction to comment
 */
async function addCommentReaction(commentId, userId, reactionType) {
  try {
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Remove existing reaction from this user
    comment.reactions = comment.reactions.filter(
      r => r.userId.toString() !== userId.toString()
    );

    // Add new reaction
    comment.reactions.push({
      userId,
      type: reactionType,
      createdAt: new Date()
    });

    await comment.save();

    logger.info('Comment reaction added', { commentId, userId, reactionType });
    return comment;
  } catch (error) {
    logger.error('Error adding comment reaction', { error: error.message, commentId });
    throw error;
  }
}

/**
 * Get comment templates
 */
async function getCommentTemplates(workspaceId, filters = {}) {
  try {
    const {
      category = null,
      type = null,
      search = null
    } = filters;

    const query = {
      $or: [
        { workspaceId },
        { isPublic: true }
      ]
    };

    if (category) query.category = category;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ];
    }

    const templates = await CommentTemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ usageCount: -1, lastUsed: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting comment templates', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Create comment template
 */
async function createCommentTemplate(workspaceId, agencyWorkspaceId, templateData) {
  try {
    const {
      name,
      text,
      type = 'comment',
      category = 'general',
      tags = [],
      isPublic = false,
      createdBy
    } = templateData;

    const template = new CommentTemplate({
      workspaceId,
      agencyWorkspaceId,
      name,
      text,
      type,
      category,
      tags,
      isPublic,
      createdBy
    });

    await template.save();

    logger.info('Comment template created', { templateId: template._id, workspaceId });
    return template;
  } catch (error) {
    logger.error('Error creating comment template', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  addRichComment,
  addCommentReaction,
  getCommentTemplates,
  createCommentTemplate
};


