// Advanced Workflow Service

const Workflow = require('../models/Workflow');
const logger = require('../utils/logger');
const {
  AppError,
  ValidationError,
  NotFoundError,
  recoveryStrategies,
} = require('../utils/errorHandler');

/**
 * Create workflow with advanced triggers
 */
async function createAdvancedWorkflow(userId, workflowData) {
  try {
    const {
      name,
      description,
      triggers,
      actions,
      conditions = [],
      schedule = null,
    } = workflowData;

    if (!triggers || triggers.length === 0) {
      throw new ValidationError('At least one trigger is required', [
        { field: 'triggers', message: 'At least one trigger is required' },
      ]);
    }

    const workflow = new Workflow({
      userId,
      name,
      description,
      triggers: triggers.map(trigger => ({
        type: trigger.type, // event, schedule, conditional
        config: trigger.config,
      })),
      actions,
      conditions,
      schedule,
      status: 'active',
      advanced: true,
    });

    await workflow.save();

    logger.info('Advanced workflow created', { userId, workflowId: workflow._id, triggers: triggers.length });
    return workflow;
  } catch (error) {
    logger.error('Create advanced workflow error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Conditional workflow execution
 */
async function executeConditionalWorkflow(workflowId, userId, context) {
  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      userId,
      status: 'active',
    }).lean();

    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    // Evaluate conditions
    const conditionsMet = evaluateConditions(workflow.conditions || [], context);

    if (!conditionsMet) {
      logger.info('Workflow conditions not met', { workflowId, userId });
      return {
        executed: false,
        reason: 'Conditions not met',
      };
    }

    // Execute actions
    const { executeWorkflow } = require('./workflowService');
    const result = await executeWorkflow(workflowId, userId, context);

    return {
      executed: true,
      conditionsMet: true,
      result,
    };
  } catch (error) {
    logger.error('Execute conditional workflow error', { error: error.message, workflowId });
    throw error;
  }
}

/**
 * Evaluate conditions
 */
function evaluateConditions(conditions, context) {
  if (conditions.length === 0) {
    return true; // No conditions = always execute
  }

  return conditions.every(condition => {
    const { field, operator, value } = condition;

    const contextValue = context[field];

    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'not_equals':
        return contextValue !== value;
      case 'greater_than':
        return contextValue > value;
      case 'less_than':
        return contextValue < value;
      case 'contains':
        return String(contextValue).includes(value);
      case 'not_contains':
        return !String(contextValue).includes(value);
      default:
        return true;
    }
  });
}

/**
 * Schedule workflow
 */
async function scheduleWorkflow(workflowId, userId, scheduleConfig) {
  try {
    const {
      type, // once, daily, weekly, monthly, cron
      time = null,
      cronExpression = null,
      timezone = 'UTC',
    } = scheduleConfig;

    const { scheduleRecurringJob } = require('./jobSchedulerService');

    let cronExpr;
    if (type === 'cron' && cronExpression) {
      cronExpr = cronExpression;
    } else {
      cronExpr = getCronForSchedule(type, time);
    }

    await scheduleRecurringJob(
      `workflow-${workflowId}`,
      {
        workflowId,
        userId,
      },
      cronExpr,
      {
        timezone,
      }
    );

    // Update workflow
    await Workflow.updateOne(
      { _id: workflowId, userId },
      { schedule: scheduleConfig }
    );

    logger.info('Workflow scheduled', { workflowId, type, cronExpr });
    return { success: true, schedule: scheduleConfig };
  } catch (error) {
    logger.error('Schedule workflow error', { error: error.message, workflowId });
    throw error;
  }
}

/**
 * Get cron expression for schedule
 */
function getCronForSchedule(type, time) {
  const [hour, minute] = time ? time.split(':').map(Number) : [9, 0];

  switch (type) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * 1`; // Monday
    case 'monthly':
      return `${minute} ${hour} 1 * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Get workflow analytics
 */
async function getWorkflowAnalytics(workflowId, userId) {
  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      userId,
    }).lean();

    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    // In production, track actual execution data
    const analytics = {
      workflowId,
      totalExecutions: workflow.executionCount || 0,
      successfulExecutions: workflow.successCount || 0,
      failedExecutions: workflow.failureCount || 0,
      successRate: workflow.executionCount > 0
        ? ((workflow.successCount || 0) / workflow.executionCount) * 100
        : 0,
      averageExecutionTime: workflow.avgExecutionTime || 0,
      lastExecuted: workflow.lastExecuted || null,
      triggers: workflow.triggers?.length || 0,
      actions: workflow.actions?.length || 0,
    };

    return analytics;
  } catch (error) {
    logger.error('Get workflow analytics error', { error: error.message, workflowId });
    throw error;
  }
}

module.exports = {
  createAdvancedWorkflow,
  executeConditionalWorkflow,
  scheduleWorkflow,
  getWorkflowAnalytics,
};

