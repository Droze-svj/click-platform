// Batch Approval Service
// Batch approvals and approval history for simple portal

const EmailApprovalToken = require('../models/EmailApprovalToken');
const ContentApproval = require('../models/ContentApproval');
const ScheduledPost = require('../models/ScheduledPost');
const { processSimpleApproval } = require('./simpleClientPortalService');
const logger = require('../utils/logger');

/**
 * Get approval history for client portal
 */
async function getApprovalHistory(token) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    // Get all approvals for this approver
    const approvals = await ContentApproval.find({
      'stages.approvals.approverId': approvalToken.approverId
    })
      .populate('contentId', 'title type')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const history = approvals.map(approval => {
      const currentStage = approval.stages?.find(s => s.stageOrder === approval.currentStage);
      const approverAction = currentStage?.approvals?.find(
        a => a.approverId.toString() === approvalToken.approverId.toString()
      );

      return {
        id: approval._id,
        title: approval.contentId?.title || 'Untitled',
        type: approval.contentId?.type || 'content',
        status: approval.status,
        currentStage: currentStage?.stageName || 'Unknown',
        action: approverAction?.status || 'pending',
        actionDate: approverAction?.approvedAt || null,
        comment: approverAction?.comment || null,
        createdAt: approval.createdAt
      };
    });

    return {
      approver: {
        id: approvalToken.approverId,
        email: approvalToken.approverEmail
      },
      history,
      total: history.length
    };
  } catch (error) {
    logger.error('Error getting approval history', { error: error.message, token });
    throw error;
  }
}

/**
 * Get pending approvals for batch processing
 */
async function getPendingApprovals(token) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    // Get pending approvals for this approver
    const approvals = await ContentApproval.find({
      'stages.approvals.approverId': approvalToken.approverId,
      'stages.approvals.status': 'pending',
      status: { $in: ['pending', 'in_progress'] }
    })
      .populate('contentId', 'title type text mediaUrl')
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    // Generate tokens for each approval
    const EmailApprovalTokenModel = require('../models/EmailApprovalToken');
    const pendingWithTokens = await Promise.all(
      approvals.map(async (approval) => {
        // Find or create token for this approval
        let token = await EmailApprovalTokenModel.findOne({
          approvalId: approval._id,
          approverId: approvalToken.approverId,
          action: 'approve',
          used: false,
          expiresAt: { $gt: new Date() }
        }).lean();

        if (!token) {
          // Create new token
          const crypto = require('crypto');
          const newToken = new EmailApprovalTokenModel({
            approvalId: approval._id,
            approverId: approvalToken.approverId,
            approverEmail: approvalToken.approverEmail,
            action: 'approve',
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          });
          await newToken.save();
          token = newToken.toObject();
        }

        return {
          approval: {
            id: approval._id,
            title: approval.contentId?.title || 'Untitled',
            type: approval.contentId?.type || 'content',
            text: approval.contentId?.text || '',
            mediaUrl: approval.contentId?.mediaUrl || null
          },
          token: token.token,
          currentStage: approval.stages?.find(s => s.stageOrder === approval.currentStage)?.stageName || 'Unknown',
          createdAt: approval.createdAt
        };
      })
    );

    return {
      pending: pendingWithTokens,
      total: pendingWithTokens.length
    };
  } catch (error) {
    logger.error('Error getting pending approvals', { error: error.message, token });
    throw error;
  }
}

/**
 * Batch approve/decline
 */
async function batchApproveDecline(token, actions) {
  try {
    // actions: [{ approvalToken, action: 'approve'|'decline', comment }]
    const results = [];

    for (const item of actions) {
      try {
        const result = await processSimpleApproval(
          item.approvalToken,
          item.action,
          item.comment || null
        );
        results.push({
          approvalToken: item.approvalToken,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          approvalToken: item.approvalToken,
          success: false,
          error: error.message
        });
      }
    }

    return {
      total: actions.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    logger.error('Error batch approving/declining', { error: error.message, token });
    throw error;
  }
}

module.exports = {
  getApprovalHistory,
  getPendingApprovals,
  batchApproveDecline
};


