// Approval Workflow Service
// Manages content approval workflows

const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ContentApproval = require('../models/ContentApproval');
const Content = require('../models/Content');
const Team = require('../models/Team');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Create a new approval workflow
 */
async function createWorkflow(userId, workflowData) {
  try {
    const workflow = new ApprovalWorkflow({
      ...workflowData,
      userId
    });

    // If this is set as default, unset other defaults
    if (workflowData.isDefault) {
      await ApprovalWorkflow.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    await workflow.save();
    logger.info('Approval workflow created', { workflowId: workflow._id, userId });
    return workflow;
  } catch (error) {
    logger.error('Error creating approval workflow', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get workflows for user or team
 */
async function getWorkflows(userId, teamId = null) {
  try {
    const query = {
      $or: [
        { userId },
        ...(teamId ? [{ teamId }] : [])
      ],
      isActive: true
    };

    const workflows = await ApprovalWorkflow.find(query)
      .populate('userId', 'name email')
      .populate('teamId', 'name')
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    return workflows;
  } catch (error) {
    logger.error('Error getting workflows', { error: error.message, userId });
    throw error;
  }
}

/**
 * Start approval process for content
 */
async function startApprovalProcess(contentId, workflowId, userId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found or unauthorized');
    }

    // Check if approval already exists
    const existingApproval = await ContentApproval.findOne({ contentId });
    if (existingApproval && existingApproval.status !== 'cancelled') {
      throw new Error('Approval process already exists for this content');
    }

    const workflow = await ApprovalWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Initialize approval stages
    const stages = workflow.stages.map((stage, index) => ({
      stageOrder: stage.order,
      stageName: stage.name,
      status: index === 0 ? 'pending' : 'pending',
      startedAt: index === 0 ? new Date() : null,
      approvals: stage.approvers.map(approver => ({
        approverId: approver.userId,
        status: 'pending'
      })),
      autoApproved: false
    }));

    // Get assigned users
    const assignedTo = workflow.stages.flatMap(stage =>
      stage.approvers.map(approver => ({
        userId: approver.userId,
        stageOrder: stage.order
      }))
    );

    const approval = new ContentApproval({
      contentId,
      workflowId,
      createdBy: userId,
      currentStage: 0,
      status: 'pending',
      stages,
      assignedTo,
      history: [{
        action: 'created',
        userId,
        comment: 'Approval process started'
      }]
    });

    await approval.save();

    // Notify first stage approvers
    await notifyStageApprovers(approval, 0);

    // Update content status
    content.status = 'pending_approval';
    await content.save();

    // Trigger webhook
    const { triggerWebhook } = require('./webhookService');
    await triggerWebhook(userId, 'approval.requested', {
      approvalId: approval._id,
      contentId,
      workflowId,
      status: 'pending',
      requestedAt: new Date()
    }, approval.workspaceId);

    logger.info('Approval process started', { approvalId: approval._id, contentId, workflowId });
    return approval;
  } catch (error) {
    logger.error('Error starting approval process', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Approve content at current stage
 */
async function approveContent(approvalId, approverId, comment = '') {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId')
      .populate('workflowId');

    if (!approval) {
      throw new Error('Approval not found');
    }

    const workflow = approval.workflowId;
    const currentStageData = approval.stages.find(s => s.stageOrder === approval.currentStage);
    
    if (!currentStageData) {
      throw new Error('Current stage not found');
    }

    // Find approver in current stage
    const approver = currentStageData.approvals.find(
      a => a.approverId.toString() === approverId.toString()
    );

    if (!approver) {
      throw new Error('You are not an approver for this stage');
    }

    if (approver.status !== 'pending') {
      throw new Error('You have already responded to this approval');
    }

    // Update approver status
    approver.status = 'approved';
    approver.comment = comment;
    approver.approvedAt = new Date();

    // Check if stage is complete
    const stageConfig = workflow.stages.find(s => s.order === approval.currentStage);
    const isStageComplete = checkStageComplete(currentStageData, stageConfig);

    if (isStageComplete) {
      currentStageData.status = 'approved';
      currentStageData.completedAt = new Date();

      // Move to next stage or complete
      const nextStage = approval.currentStage + 1;
      if (nextStage < workflow.stages.length) {
        approval.currentStage = nextStage;
        approval.stages[nextStage].status = 'in_progress';
        approval.stages[nextStage].startedAt = new Date();
        approval.status = 'in_progress';

        // Notify next stage approvers
        await notifyStageApprovers(approval, nextStage);
      } else {
        // All stages complete
        approval.status = 'approved';
        approval.approvedAt = new Date();
        approval.finalApprover = approverId;

        // Update content status
        const content = approval.contentId;
        content.status = 'approved';
        await content.save();

        // Notify creator
        notificationService.notifyUser(content.userId, {
          type: 'success',
          title: 'Content Approved',
          message: `Your content "${content.title}" has been approved and is ready to publish.`
        });

        // Trigger webhook
        const { triggerWebhook } = require('./webhookService');
        await triggerWebhook(content.userId, 'content.approved', {
          contentId: content._id,
          approvalId: approval._id,
          title: content.title,
          approvedBy: approverId,
          approvedAt: new Date()
        }, approval.workspaceId);
      }
    }

    // Add to history
    approval.history.push({
      action: 'approved',
      userId: approverId,
      stageOrder: approval.currentStage,
      comment
    });

    await approval.save();

    // Trigger webhook for approval completion
    if (approval.status === 'approved') {
      const { triggerWebhook } = require('./webhookService');
      await triggerWebhook(content.userId, 'approval.completed', {
        approvalId: approval._id,
        contentId: content._id,
        status: 'approved',
        completedAt: new Date()
      }, approval.workspaceId);
    }

    logger.info('Content approved', { approvalId, approverId, stage: approval.currentStage });
    return approval;
  } catch (error) {
    logger.error('Error approving content', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Reject content
 */
async function rejectContent(approvalId, approverId, rejectionReason, comment = '') {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId')
      .populate('workflowId');

    if (!approval) {
      throw new Error('Approval not found');
    }

    const currentStageData = approval.stages.find(s => s.stageOrder === approval.currentStage);
    const approver = currentStageData.approvals.find(
      a => a.approverId.toString() === approverId.toString()
    );

    if (!approver) {
      throw new Error('You are not an approver for this stage');
    }

    // Update approver status
    approver.status = 'rejected';
    approver.rejectionReason = rejectionReason;
    approver.comment = comment;
    approver.approvedAt = new Date();

    // Reject stage and approval
    currentStageData.status = 'rejected';
    currentStageData.completedAt = new Date();
    approval.status = 'rejected';
    approval.rejectedAt = new Date();
    approval.rejectionReason = rejectionReason;

    // Update content status
    const content = approval.contentId;
    content.status = 'rejected';
    await content.save();

    // Add to history
    approval.history.push({
      action: 'rejected',
      userId: approverId,
      stageOrder: approval.currentStage,
      comment: `${rejectionReason}. ${comment}`
    });

    await approval.save();

    // Trigger webhook
    const { triggerWebhook } = require('./webhookService');
    await triggerWebhook(content.userId, 'content.rejected', {
      contentId: content._id,
      approvalId: approval._id,
      title: content.title,
      rejectedBy: approverId,
      rejectionReason,
      rejectedAt: new Date()
    }, approval.workspaceId).catch(err => logger.warn('Webhook trigger failed', { error: err.message }));

    // Notify creator
    notificationService.notifyUser(content.userId, {
      type: 'warning',
      title: 'Content Rejected',
      message: `Your content "${content.title}" was rejected: ${rejectionReason}`
    });

    logger.info('Content rejected', { approvalId, approverId, reason: rejectionReason });
    return approval;
  } catch (error) {
    logger.error('Error rejecting content', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Request changes
 */
async function requestChanges(approvalId, approverId, requestedChanges, comment = '') {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId')
      .populate('workflowId');

    if (!approval) {
      throw new Error('Approval not found');
    }

    const currentStageData = approval.stages.find(s => s.stageOrder === approval.currentStage);
    const approver = currentStageData.approvals.find(
      a => a.approverId.toString() === approverId.toString()
    );

    if (!approver) {
      throw new Error('You are not an approver for this stage');
    }

    // Update approver status
    approver.status = 'changes_requested';
    approver.requestedChanges = requestedChanges;
    approver.comment = comment;
    approver.approvedAt = new Date();

    // Update stage status
    currentStageData.status = 'changes_requested';
    approval.status = 'changes_requested';

    // Update content status
    const content = approval.contentId;
    content.status = 'changes_requested';
    await content.save();

    // Add to history
    approval.history.push({
      action: 'changes_requested',
      userId: approverId,
      stageOrder: approval.currentStage,
      comment: `${requestedChanges}. ${comment}`
    });

    await approval.save();

    // Notify creator
    notificationService.notifyUser(content.userId, {
      type: 'info',
      title: 'Changes Requested',
      message: `Changes requested for "${content.title}": ${requestedChanges}`
    });

    logger.info('Changes requested', { approvalId, approverId });
    return approval;
  } catch (error) {
    logger.error('Error requesting changes', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Resubmit content after changes
 */
async function resubmitContent(approvalId, userId) {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId')
      .populate('workflowId');

    if (!approval) {
      throw new Error('Approval not found');
    }

    const content = approval.contentId;
    if (content.userId.toString() !== userId.toString()) {
      throw new Error('Only content creator can resubmit');
    }

    if (approval.status !== 'changes_requested') {
      throw new Error('Content is not in changes requested status');
    }

    // Reset current stage approvals
    const currentStageData = approval.stages.find(s => s.stageOrder === approval.currentStage);
    currentStageData.approvals.forEach(approval => {
      if (approval.status === 'changes_requested') {
        approval.status = 'pending';
        approval.requestedChanges = '';
      }
    });

    currentStageData.status = 'in_progress';
    approval.status = 'in_progress';
    content.status = 'pending_approval';

    // Add to history
    approval.history.push({
      action: 'stage_started',
      userId,
      stageOrder: approval.currentStage,
      comment: 'Content resubmitted after changes'
    });

    await Promise.all([approval.save(), content.save()]);

    // Notify approvers
    await notifyStageApprovers(approval, approval.currentStage);

    logger.info('Content resubmitted', { approvalId, userId });
    return approval;
  } catch (error) {
    logger.error('Error resubmitting content', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Check if stage is complete
 */
function checkStageComplete(stageData, stageConfig) {
  if (!stageConfig) return false;

  const { approvalType } = stageConfig;
  const approvals = stageData.approvals;

  if (approvalType === 'all') {
    // All required approvers must approve
    const requiredApprovers = approvals.filter(a => {
      const approverConfig = stageConfig.approvers.find(
        ap => ap.userId.toString() === a.approverId.toString()
      );
      return approverConfig && approverConfig.role === 'required';
    });
    return requiredApprovers.every(a => a.status === 'approved');
  } else if (approvalType === 'any') {
    // Any approver can approve
    return approvals.some(a => a.status === 'approved');
  } else if (approvalType === 'majority') {
    // Majority must approve
    const approvedCount = approvals.filter(a => a.status === 'approved').length;
    return approvedCount > approvals.length / 2;
  }

  return false;
}

/**
 * Notify stage approvers
 */
async function notifyStageApprovers(approval, stageOrder) {
  try {
    const stageData = approval.stages.find(s => s.stageOrder === stageOrder);
    if (!stageData) return;

    const pendingApprovers = stageData.approvals.filter(a => a.status === 'pending');
    
    for (const approver of pendingApprovers) {
      notificationService.notifyUser(approver.approverId, {
        type: 'info',
        title: 'Approval Required',
        message: `You have a pending approval for content in stage "${stageData.stageName}"`,
        data: {
          approvalId: approval._id,
          contentId: approval.contentId,
          stageOrder
        }
      });
    }
  } catch (error) {
    logger.error('Error notifying approvers', { error: error.message });
  }
}

/**
 * Get approvals for user
 */
async function getUserApprovals(userId, status = null) {
  try {
    const query = {
      'assignedTo.userId': userId
    };

    if (status) {
      query.status = status;
    }

    const approvals = await ContentApproval.find(query)
      .populate('contentId', 'title type status')
      .populate('createdBy', 'name email')
      .populate('workflowId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return approvals;
  } catch (error) {
    logger.error('Error getting user approvals', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get approval details
 */
async function getApprovalDetails(approvalId, userId) {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId')
      .populate('createdBy', 'name email')
      .populate('workflowId')
      .populate('assignedTo.userId', 'name email')
      .populate('stages.approvals.approverId', 'name email')
      .lean();

    if (!approval) {
      throw new Error('Approval not found');
    }

    return approval;
  } catch (error) {
    logger.error('Error getting approval details', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Cancel approval process
 */
async function cancelApproval(approvalId, userId) {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId');

    if (!approval) {
      throw new Error('Approval not found');
    }

    const content = approval.contentId;
    if (content.userId.toString() !== userId.toString()) {
      throw new Error('Only content creator can cancel approval');
    }

    approval.status = 'cancelled';
    content.status = 'draft';

    approval.history.push({
      action: 'cancelled',
      userId,
      comment: 'Approval process cancelled by creator'
    });

    await Promise.all([approval.save(), content.save()]);

    logger.info('Approval cancelled', { approvalId, userId });
    return approval;
  } catch (error) {
    logger.error('Error cancelling approval', { error: error.message, approvalId });
    throw error;
  }
}

module.exports = {
  createWorkflow,
  getWorkflows,
  startApprovalProcess,
  approveContent,
  rejectContent,
  requestChanges,
  resubmitContent,
  getUserApprovals,
  getApprovalDetails,
  cancelApproval
};

