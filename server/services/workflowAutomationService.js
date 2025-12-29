// Workflow Automation Service
// Auto-advance rules, conditional routing, delegation

const ContentApproval = require('../models/ContentApproval');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const logger = require('../utils/logger');

/**
 * Auto-advance approval based on rules
 */
async function autoAdvanceApproval(approvalId, rules) {
  try {
    const approval = await ContentApproval.findById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Check if auto-advance conditions are met
    for (const rule of rules) {
      if (evaluateRule(approval, rule)) {
        // Auto-advance
        const { advanceToNextStage } = require('./multiStepWorkflowService');
        await advanceToNextStage(
          approvalId,
          rule.autoApproverId || approval.createdBy,
          'approved',
          rule.comment || 'Auto-approved based on rule'
        );

        logger.info('Approval auto-advanced', { approvalId, rule: rule.name });
        return { advanced: true, rule: rule.name };
      }
    }

    return { advanced: false };
  } catch (error) {
    logger.error('Error auto-advancing approval', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Evaluate auto-advance rule
 */
function evaluateRule(approval, rule) {
  // Rule conditions
  const conditions = rule.conditions || [];

  for (const condition of conditions) {
    switch (condition.type) {
      case 'priority':
        if (approval.metadata?.priority !== condition.value) {
          return false;
        }
        break;
      case 'content_type':
        // Would check content type
        break;
      case 'word_count':
        // Would check content word count
        break;
      case 'has_tag':
        if (!approval.metadata?.tags?.includes(condition.value)) {
          return false;
        }
        break;
      case 'stage':
        if (approval.currentStage !== condition.value) {
          return false;
        }
        break;
    }
  }

  return true;
}

/**
 * Conditional routing - route to different approvers based on conditions
 */
async function routeConditionally(approvalId, routingRules) {
  try {
    const approval = await ContentApproval.findById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Evaluate routing rules
    for (const rule of routingRules) {
      if (evaluateRule(approval, rule)) {
        // Route to specified approver
        const currentStage = approval.stages.find(s => s.stageOrder === approval.currentStage);
        if (currentStage) {
          // Add or replace approver
          currentStage.approvals = [{
            approverId: rule.approverId,
            status: 'pending'
          }];

          approval.assignedTo = approval.assignedTo.filter(
            a => a.stageOrder !== approval.currentStage
          );
          approval.assignedTo.push({
            userId: rule.approverId,
            stageOrder: approval.currentStage,
            assignedAt: new Date()
          });

          await approval.save();

          logger.info('Approval conditionally routed', { approvalId, rule: rule.name, approverId: rule.approverId });
          return { routed: true, rule: rule.name, approverId: rule.approverId };
        }
      }
    }

    return { routed: false };
  } catch (error) {
    logger.error('Error conditionally routing approval', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Delegate approval
 */
async function delegateApproval(approvalId, fromUserId, toUserId, stageOrder, expiresAt = null) {
  try {
    const approval = await ContentApproval.findById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    const stage = approval.stages.find(s => s.stageOrder === stageOrder);
    if (!stage) {
      throw new Error('Stage not found');
    }

    // Find original approver
    const originalApprover = stage.approvals.find(
      a => a.approverId.toString() === fromUserId.toString()
    );

    if (!originalApprover) {
      throw new Error('Original approver not found in this stage');
    }

    // Replace approver
    originalApprover.approverId = toUserId;
    originalApprover.delegatedFrom = fromUserId;
    originalApprover.delegatedAt = new Date();
    if (expiresAt) {
      originalApprover.delegationExpiresAt = new Date(expiresAt);
    }

    // Update assignedTo
    const assigned = approval.assignedTo.find(
      a => a.userId.toString() === fromUserId.toString() && a.stageOrder === stageOrder
    );
    if (assigned) {
      assigned.userId = toUserId;
      assigned.delegatedFrom = fromUserId;
      assigned.delegatedAt = new Date();
    }

    await approval.save();

    // Notify new approver
    const NotificationService = require('./notificationService');
    await NotificationService.notifyUser(toUserId.toString(), {
      type: 'approval_delegated',
      title: 'Approval Delegated to You',
      message: `An approval has been delegated to you`,
      data: {
        approvalId: approval._id,
        delegatedFrom: fromUserId
      }
    });

    logger.info('Approval delegated', { approvalId, fromUserId, toUserId, stageOrder });
    return approval;
  } catch (error) {
    logger.error('Error delegating approval', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Create auto-advance rule
 */
async function createAutoAdvanceRule(workspaceId, ruleData) {
  try {
    const {
      name,
      conditions,
      autoApproverId,
      comment,
      enabled = true
    } = ruleData;

    // Store in workflow or separate collection
    // For now, return rule object
    const rule = {
      id: require('mongoose').Types.ObjectId(),
      workspaceId,
      name,
      conditions,
      autoApproverId,
      comment,
      enabled,
      createdAt: new Date()
    };

    logger.info('Auto-advance rule created', { ruleId: rule.id, workspaceId });
    return rule;
  } catch (error) {
    logger.error('Error creating auto-advance rule', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  autoAdvanceApproval,
  routeConditionally,
  delegateApproval,
  createAutoAdvanceRule
};


