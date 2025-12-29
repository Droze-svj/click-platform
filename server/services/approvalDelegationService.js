// Approval Delegation Service
// Delegate approvals to other users

const ApprovalDelegation = require('../models/ApprovalDelegation');
const ContentApproval = require('../models/ContentApproval');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Delegate approval
 */
async function delegateApproval(approvalId, stageOrder, fromUserId, toUserId, options = {}) {
  try {
    const {
      reason = '',
      expiresAt = null
    } = options;

    const approval = await ContentApproval.findById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Check if user is assigned to this stage
    const stage = approval.stages.find(s => s.stageOrder === stageOrder);
    if (!stage) {
      throw new Error('Stage not found');
    }

    const isAssigned = stage.approvals.some(a => a.approverId.toString() === fromUserId.toString());
    if (!isAssigned) {
      throw new Error('User not assigned to this stage');
    }

    // Create delegation
    const delegation = new ApprovalDelegation({
      approvalId,
      stageOrder,
      delegatedFrom: fromUserId,
      delegatedTo: toUserId,
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: 'active'
    });

    await delegation.save();

    // Update approval to include delegated approver
    const delegatedApprover = stage.approvals.find(a => a.approverId.toString() === fromUserId.toString());
    if (delegatedApprover) {
      // Add delegated approver
      stage.approvals.push({
        approverId: toUserId,
        status: 'pending',
        createdAt: new Date(),
        metadata: {
          delegated: true,
          delegatedFrom: fromUserId
        }
      });
    }

    await approval.save();

    // Notify delegated user
    const notificationService = require('./notificationService');
    await notificationService.sendNotification(toUserId, {
      type: 'approval_delegated',
      title: 'Approval Delegated to You',
      message: `An approval has been delegated to you`,
      link: `/approvals/${approvalId}`
    });

    logger.info('Approval delegated', { approvalId, fromUserId, toUserId });
    return delegation;
  } catch (error) {
    logger.error('Error delegating approval', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Revoke delegation
 */
async function revokeDelegation(delegationId, userId) {
  try {
    const delegation = await ApprovalDelegation.findById(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Check if user can revoke (original delegator or admin)
    if (delegation.delegatedFrom.toString() !== userId.toString()) {
      // Check if user is admin (would need role check)
      throw new Error('Not authorized to revoke this delegation');
    }

    delegation.status = 'revoked';
    delegation.revokedAt = new Date();
    delegation.revokedBy = userId;
    await delegation.save();

    // Remove delegated approver from approval
    const approval = await ContentApproval.findById(delegation.approvalId);
    if (approval) {
      const stage = approval.stages.find(s => s.stageOrder === delegation.stageOrder);
      if (stage) {
        stage.approvals = stage.approvals.filter(a => 
          !(a.approverId.toString() === delegation.delegatedTo.toString() && 
            a.metadata?.delegated)
        );
        await approval.save();
      }
    }

    logger.info('Delegation revoked', { delegationId, userId });
    return delegation;
  } catch (error) {
    logger.error('Error revoking delegation', { error: error.message, delegationId });
    throw error;
  }
}

/**
 * Get delegations for user
 */
async function getUserDelegations(userId, filters = {}) {
  try {
    const {
      status = 'active',
      type = 'all' // 'received', 'sent', 'all'
    } = filters;

    const query = { status };
    
    if (type === 'received') {
      query.delegatedTo = userId;
    } else if (type === 'sent') {
      query.delegatedFrom = userId;
    } else {
      query.$or = [
        { delegatedTo: userId },
        { delegatedFrom: userId }
      ];
    }

    const delegations = await ApprovalDelegation.find(query)
      .populate('approvalId', 'contentId status currentStage')
      .populate('delegatedFrom', 'name email')
      .populate('delegatedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return delegations;
  } catch (error) {
    logger.error('Error getting user delegations', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  delegateApproval,
  revokeDelegation,
  getUserDelegations
};


