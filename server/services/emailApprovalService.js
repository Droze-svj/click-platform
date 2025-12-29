// Email Approval Service
// Handle approvals via email links

const EmailApprovalToken = require('../models/EmailApprovalToken');
const ContentApproval = require('../models/ContentApproval');
const { advanceToNextStage } = require('./multiStepWorkflowService');
const logger = require('../utils/logger');

/**
 * Process email approval
 */
async function processEmailApproval(token, action, comment = '', ipAddress = null, userAgent = null) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!approvalToken) {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }

    // Validate action matches token
    if (approvalToken.action !== action) {
      return {
        success: false,
        error: 'Action does not match token'
      };
    }

    // Get approval
    const approval = await ContentApproval.findById(approvalToken.approvalId);
    if (!approval) {
      return {
        success: false,
        error: 'Approval not found'
      };
    }

    // Process approval
    // For email approvals, we need to find the approver by email
    const User = require('../models/User');
    const approver = await User.findOne({ email: approvalToken.approverEmail });

    if (!approver) {
      // Client portal user
      const ClientPortalUser = require('../models/ClientPortalUser');
      const portalUser = await ClientPortalUser.findOne({ email: approvalToken.approverEmail });
      
      if (!portalUser) {
        return {
          success: false,
          error: 'Approver not found'
        };
      }

      // Use portal user ID (would need to map to User or handle differently)
      // For now, use a system user or handle via email
    }

    // Advance stage
    const approverId = approver?._id || approvalToken.approverEmail; // Fallback to email
    await advanceToNextStage(approval._id, approverId, action, comment);

    // Mark token as used
    approvalToken.used = true;
    approvalToken.usedAt = new Date();
    approvalToken.ipAddress = ipAddress;
    approvalToken.userAgent = userAgent;
    await approvalToken.save();

    logger.info('Email approval processed', {
      token,
      action,
      approvalId: approval._id
    });

    return {
      success: true,
      approvalId: approval._id,
      message: action === 'approve' ? 'Content approved successfully' :
               action === 'reject' ? 'Content rejected' :
               'Changes requested'
    };
  } catch (error) {
    logger.error('Error processing email approval', { error: error.message, token });
    return {
      success: false,
      error: 'Error processing approval'
    };
  }
}

/**
 * Get approval preview from token
 */
async function getApprovalPreview(token) {
  try {
    const approvalToken = await EmailApprovalToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate('approvalId');

    if (!approvalToken) {
      throw new Error('Invalid or expired token');
    }

    const approval = await ContentApproval.findById(approvalToken.approvalId)
      .populate('contentId', 'title type content')
      .populate('createdBy', 'name email')
      .lean();

    return {
      approval: {
        id: approval._id,
        content: {
          title: approval.contentId?.title,
          type: approval.contentId?.type,
          preview: approval.contentId?.content?.text?.substring(0, 500)
        },
        createdBy: approval.createdBy?.name,
        currentStage: approval.stages.find(s => s.stageOrder === approval.currentStage),
        status: approval.status
      },
      token: {
        action: approvalToken.action,
        expiresAt: approvalToken.expiresAt,
        approverEmail: approvalToken.approverEmail
      }
    };
  } catch (error) {
    logger.error('Error getting approval preview', { error: error.message, token });
    throw error;
  }
}

module.exports = {
  processEmailApproval,
  getApprovalPreview
};


