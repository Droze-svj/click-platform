// Workflow Template Service
// Create and manage workflow templates

const WorkflowTemplate = require('../models/WorkflowTemplate');
const { createMultiStepApproval } = require('./multiStepWorkflowService');
const logger = require('../utils/logger');

/**
 * Create workflow template
 */
async function createWorkflowTemplate(agencyWorkspaceId, userId, templateData) {
  try {
    const template = new WorkflowTemplate({
      ...templateData,
      agencyWorkspaceId,
      createdBy: userId
    });

    // If setting as default, unset other defaults
    if (template.isDefault) {
      await WorkflowTemplate.updateMany(
        { agencyWorkspaceId, isDefault: true },
        { isDefault: false }
      );
    }

    await template.save();
    logger.info('Workflow template created', { templateId: template._id, agencyWorkspaceId });
    return template;
  } catch (error) {
    logger.error('Error creating workflow template', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Create approval from template
 */
async function createApprovalFromTemplate(templateId, contentId, options = {}) {
  try {
    const template = await WorkflowTemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Increment usage
    template.usageCount++;
    await template.save();

    // Extract workflow configuration
    const stages = template.workflow.stages;
    const internalReviewStage = stages.find(s => s.stageType === 'internal_review');
    const clientApprovalStage = stages.find(s => s.stageType === 'client_approval');

    // Get approvers
    const internalReviewer = internalReviewStage?.approvers?.[0];
    const clientApprover = clientApprovalStage?.approvers?.[0];

    // Override with options if provided
    const internalReviewerId = options.internalReviewerId || internalReviewer?.userId;
    const clientApproverId = options.clientApproverId || clientApprover?.userId;
    const clientApproverEmail = options.clientApproverEmail || clientApprover?.email;

    // Create approval
    const approval = await createMultiStepApproval(contentId, {
      workspaceId: options.workspaceId,
      createdBy: options.createdBy,
      internalReviewerId,
      clientApproverId,
      clientApproverEmail,
      scheduledPostId: options.scheduledPostId
    });

    // Apply SLA if configured
    if (internalReviewStage?.sla?.enabled || clientApprovalStage?.sla?.enabled) {
      await applySLA(approval._id, stages);
    }

    return approval;
  } catch (error) {
    logger.error('Error creating approval from template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Apply SLA to approval
 */
async function applySLA(approvalId, stages) {
  try {
    const ApprovalSLA = require('../models/ApprovalSLA');
    const approval = await require('../models/ContentApproval').findById(approvalId);

    for (const stage of stages) {
      if (stage.sla?.enabled) {
        const targetCompletionAt = new Date();
        targetCompletionAt.setHours(targetCompletionAt.getHours() + (stage.sla.hours || 24));

        const sla = new ApprovalSLA({
          approvalId,
          stageOrder: stage.stageOrder,
          stageName: stage.stageName,
          targetHours: stage.sla.hours,
          targetCompletionAt,
          escalatedTo: stage.sla.escalateTo
        });

        await sla.save();
      }
    }
  } catch (error) {
    logger.error('Error applying SLA', { error: error.message, approvalId });
  }
}

/**
 * Get default template for workspace
 */
async function getDefaultTemplate(agencyWorkspaceId) {
  try {
    const template = await WorkflowTemplate.findOne({
      agencyWorkspaceId,
      isDefault: true
    });

    return template;
  } catch (error) {
    logger.error('Error getting default template', { error: error.message, agencyWorkspaceId });
    return null;
  }
}

/**
 * Create default templates
 */
async function createDefaultTemplates(agencyWorkspaceId, userId) {
  try {
    const templates = [];

    // Standard workflow
    const standard = await createWorkflowTemplate(agencyWorkspaceId, userId, {
      name: 'Standard Workflow',
      description: 'Creator → Internal Review → Client Approval → Scheduled',
      workflow: {
        stages: [
          {
            stageOrder: 0,
            stageName: 'Created',
            stageType: 'creator'
          },
          {
            stageOrder: 1,
            stageName: 'Internal Review',
            stageType: 'internal_review',
            sla: {
              enabled: true,
              hours: 24,
              autoApprove: false
            }
          },
          {
            stageOrder: 2,
            stageName: 'Client Approval',
            stageType: 'client_approval',
            sla: {
              enabled: true,
              hours: 48,
              autoApprove: false
            }
          },
          {
            stageOrder: 3,
            stageName: 'Scheduled',
            stageType: 'scheduled'
          }
        ],
        settings: {
          allowParallelApprovals: false,
          allowDelegation: true,
          autoScheduleOnApproval: true
        }
      },
      isDefault: true
    });

    templates.push(standard);

    // Fast-track workflow (no internal review)
    const fastTrack = await createWorkflowTemplate(agencyWorkspaceId, userId, {
      name: 'Fast-Track Workflow',
      description: 'Creator → Client Approval → Scheduled',
      workflow: {
        stages: [
          {
            stageOrder: 0,
            stageName: 'Created',
            stageType: 'creator'
          },
          {
            stageOrder: 1,
            stageName: 'Client Approval',
            stageType: 'client_approval',
            sla: {
              enabled: true,
              hours: 24,
              autoApprove: false
            }
          },
          {
            stageOrder: 2,
            stageName: 'Scheduled',
            stageType: 'scheduled'
          }
        ],
        settings: {
          allowParallelApprovals: false,
          allowDelegation: true,
          autoScheduleOnApproval: true
        }
      }
    });

    templates.push(fastTrack);

    return templates;
  } catch (error) {
    logger.error('Error creating default templates', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  createWorkflowTemplate,
  createApprovalFromTemplate,
  getDefaultTemplate,
  createDefaultTemplates
};
