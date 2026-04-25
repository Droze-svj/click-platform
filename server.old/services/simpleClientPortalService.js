// Simple Client Portal Service
// Ultra-simple approve/decline + comment interface

const EmailApprovalToken = require('../models/EmailApprovalToken');
const ContentApproval = require('../models/ContentApproval');
const ScheduledPost = require('../models/ScheduledPost');
const PostComment = require('../models/PostComment');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Get simple approval view (for email/mobile)
 */
async function getSimpleApprovalView(token) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    const approval = await ContentApproval.findById(approvalToken.approvalId)
      .populate('contentId', 'title type text mediaUrl')
      .populate('createdBy', 'name email')
      .lean();

    if (!approval) {
      throw new Error('Approval not found');
    }

    // Get post if exists
    let post = null;
    if (approval.contentId) {
      post = await ScheduledPost.findOne({ contentId: approval.contentId._id })
        .select('content platform scheduledTime')
        .lean();
    }

    // Get existing comments (only visible to client)
    const comments = await PostComment.find({
      postId: post?._id,
      isInternal: false // Only show non-internal comments
    })
      .populate('userId', 'name')
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    // Get current stage info
    const currentStage = approval.stages?.find(s => s.stageOrder === approval.currentStage);
    const stageName = currentStage?.stageName || 'Approval';

    return {
      approval: {
        id: approval._id,
        title: approval.contentId?.title || 'Content Approval',
        content: {
          text: approval.contentId?.text || post?.content?.text || '',
          mediaUrl: approval.contentId?.mediaUrl || post?.content?.mediaUrl || null,
          type: approval.contentId?.type || 'post'
        },
        stage: {
          name: stageName,
          order: approval.currentStage
        },
        createdBy: approval.createdBy?.name || 'Team Member',
        createdAt: approval.createdAt
      },
      actions: {
        approve: {
          url: `/api/simple-portal/${token}/approve`,
          method: 'POST'
        },
        decline: {
          url: `/api/simple-portal/${token}/decline`,
          method: 'POST'
        },
        comment: {
          url: `/api/simple-portal/${token}/comment`,
          method: 'POST'
        }
      },
      comments: comments.map(c => ({
        id: c._id,
        text: c.text,
        author: c.userId?.name || 'Unknown',
        createdAt: c.createdAt,
        type: c.type
      })),
      token: token, // For client-side actions
      simple: true // Flag for ultra-simple UI
    };
  } catch (error) {
    logger.error('Error getting simple approval view', { error: error.message, token });
    throw error;
  }
}

/**
 * Process simple approval
 */
async function processSimpleApproval(token, action, comment = null) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    const approval = await ContentApproval.findById(approvalToken.approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Add comment if provided
    if (comment && comment.trim()) {
      const post = await ScheduledPost.findOne({ contentId: approval.contentId });
      if (post) {
        const postComment = new PostComment({
          postId: post._id,
          contentId: approval.contentId,
          userId: approvalToken.approverId,
          text: comment,
          type: action === 'approve' ? 'approval' : 'rejection',
          isInternal: false // Client comments are visible
        });
        await postComment.save();
      }
    }

    // Process approval action
    if (action === 'approve') {
      // Use existing approval workflow service
      const { advanceToNextStage } = require('./multiStepWorkflowService');
      await advanceToNextStage(approval._id, approvalToken.approverId, 'approved', comment || 'Approved via simple portal');
    } else if (action === 'decline') {
      const { advanceToNextStage } = require('./multiStepWorkflowService');
      await advanceToNextStage(approval._id, approvalToken.approverId, 'rejected', comment || 'Declined via simple portal');
    }

    // Mark token as used
    approvalToken.used = true;
    approvalToken.usedAt = new Date();
    await approvalToken.save();

    logger.info('Simple approval processed', { token, action, approvalId: approval._id });
    return { success: true, action, message: `Content ${action === 'approve' ? 'approved' : 'declined'} successfully` };
  } catch (error) {
    logger.error('Error processing simple approval', { error: error.message, token });
    throw error;
  }
}

/**
 * Add comment via simple portal
 */
async function addSimpleComment(token, commentText) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    const approval = await ContentApproval.findById(approvalToken.approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    const post = await ScheduledPost.findOne({ contentId: approval.contentId });
    if (!post) {
      throw new Error('Post not found');
    }

    const postComment = new PostComment({
      postId: post._id,
      contentId: approval.contentId,
      userId: approvalToken.approverId,
      text: commentText,
      type: 'comment',
      isInternal: false
    });

    await postComment.save();

    logger.info('Simple comment added', { token, commentId: postComment._id });
    return { success: true, comment: postComment };
  } catch (error) {
    logger.error('Error adding simple comment', { error: error.message, token });
    throw error;
  }
}

module.exports = {
  getSimpleApprovalView,
  processSimpleApproval,
  addSimpleComment
};

