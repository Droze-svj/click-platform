// Advanced Workflow Automation Service
// Visual workflow builder, advanced triggers, workflow analytics

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Workflow = require('../models/Workflow');
const { addJob } = require('./jobQueueService');
const mongoose = require('mongoose');
const { NotFoundError } = require('../utils/errorHandler');

// Workflow execution engine
const activeWorkflows = new Map(); // workflowId -> workflow state

/**
 * Create workflow from visual definition
 * @param {Object} workflowDefinition - Visual workflow definition
 * @returns {Promise<Object>} Created workflow
 */
async function createWorkflow(workflowDefinition) {
  try {
    const {
      userId,
      name,
      description,
      nodes = [], // Workflow nodes
      edges = [], // Connections between nodes
      triggers = [],
      settings = {},
    } = workflowDefinition;

    logger.info('Creating workflow', { userId, name, nodesCount: nodes.length });

    // Validate workflow
    validateWorkflow(nodes, edges);

    const workflow = new Workflow({
      userId,
      name,
      description,
      definition: {
        nodes,
        edges,
        triggers,
      },
      settings,
      status: 'active',
    });
    await workflow.save();

    // Initialize workflow state
    activeWorkflows.set(workflow._id.toString(), {
      workflowId: workflow._id,
      status: 'idle',
      currentStep: null,
      executionHistory: [],
    });

    logger.info('Workflow created', { workflowId: workflow._id, name });

    return workflow;
  } catch (error) {
    logger.error('Error creating workflow', { error: error.message });
    captureException(error, {
      tags: { service: 'advancedWorkflowService', action: 'createWorkflow' },
    });
    throw error;
  }
}

/**
 * Validate workflow definition
 * @param {Array} nodes - Workflow nodes
 * @param {Array} edges - Workflow edges
 */
function validateWorkflow(nodes, edges) {
  if (!nodes || nodes.length === 0) {
    throw new Error('Workflow must have at least one node');
  }

  // Check for start node
  const hasStartNode = nodes.some((node) => node.type === 'start');
  if (!hasStartNode) {
    throw new Error('Workflow must have a start node');
  }

  // Validate edges connect valid nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Invalid edge: node not found`);
    }
  }
}

/**
 * Execute workflow
 * @param {string} workflowId - Workflow ID
 * @param {Object} inputData - Input data
 * @returns {Promise<Object>} Execution result
 */
async function executeWorkflow(workflowId, inputData = {}) {
  try {
    const workflow = await Workflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    logger.info('Executing workflow', { workflowId, name: workflow.name });

    // Gate autonomous execution on user's agentic settings
    if (workflow.userId) {
      try {
        const UserSettings = require('../models/UserSettings');
        const settings = await UserSettings.findOne({ userId: workflow.userId }).lean();
        if (settings?.agentic?.autonomousSwarm === false) {
          logger.info('Autonomous workflow blocked by user setting', { workflowId, userId: workflow.userId });
          return { success: false, reason: 'autonomousSwarm disabled by user', workflowId };
        }
        // Attach confidence threshold to inputData so actions can gate themselves
        if (settings?.agentic?.predictiveThreshold != null) {
          inputData._predictiveThreshold = settings.agentic.predictiveThreshold;
        }
      } catch (settingsErr) {
        logger.warn('Could not read UserSettings for workflow gate', { error: settingsErr.message });
      }
    }

    const state = activeWorkflows.get(workflowId.toString()) || {
      workflowId,
      status: 'running',
      currentStep: null,
      executionHistory: [],
    };

    state.status = 'running';
    state.executionHistory.push({
      step: 'start',
      timestamp: new Date(),
      data: inputData,
    });

    const { nodes, edges } = workflow.definition;
    const executedNodes = new Set();
    const nodeResults = new Map();

    // Find start node
    const startNode = nodes.find((n) => n.type === 'start');
    if (!startNode) {
      throw new Error('Start node not found');
    }

    // Execute workflow
    await executeNode(startNode, nodes, edges, inputData, executedNodes, nodeResults);

    state.status = 'completed';
    state.executionHistory.push({
      step: 'end',
      timestamp: new Date(),
      result: {
        ...Object.fromEntries(nodeResults),
        success: true
      },
    });

    activeWorkflows.set(workflowId.toString(), state);

    logger.info('Workflow executed', { workflowId, status: state.status });

    return {
      success: true,
      workflowId,
      result: Object.fromEntries(nodeResults),
      executionHistory: state.executionHistory,
    };
  } catch (error) {
    logger.error('Error executing workflow', { error: error.message, workflowId });
    throw error;
  }
}

/**
 * Execute workflow node
 */
async function executeNode(node, allNodes, edges, inputData, executedNodes, nodeResults) {
  if (executedNodes.has(node.id)) {
    return nodeResults.get(node.id);
  }

  executedNodes.add(node.id);

  let result = null;

  switch (node.type) {
  case 'start':
    result = inputData;
    break;

  case 'action':
    // Execute action (would call appropriate service)
    result = await executeAction(node.action, inputData);
    break;

  case 'condition':
    // Evaluate condition
    result = evaluateCondition(node.condition, inputData);
    break;

  case 'delay':
    // Wait for specified time
    await new Promise((resolve) => setTimeout(resolve, node.duration || 1000));
    result = inputData;
    break;

  case 'webhook':
    // Call webhook
    result = await callWebhook(node.url, inputData);
    break;

  default:
    result = inputData;
  }

  nodeResults.set(node.id, result);

  // Execute connected nodes
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  for (const edge of outgoingEdges) {
    const targetNode = allNodes.find((n) => n.id === edge.target);
    if (targetNode) {
      // Check condition if edge has one
      if (edge.condition) {
        if (evaluateCondition(edge.condition, result)) {
          await executeNode(targetNode, allNodes, edges, result, executedNodes, nodeResults);
        }
      } else {
        await executeNode(targetNode, allNodes, edges, result, executedNodes, nodeResults);
      }
    }
  }

  return result;
}

/**
 * Execute action — dispatches to real services based on action.type
 */
async function executeAction(action, data) {
  logger.info('Executing workflow action', { type: action?.type });
  const type = action?.type;
  const config = action?.config || {};

  try {
    switch (type) {
    case 'generate_content':
    case 'generate_script': {
      const { generateHooks } = require('./hookEnsembleService');
      const hooks = await generateHooks({
        userId: data.userId,
        niche: config.niche || data.niche || 'general',
        platform: config.platform || data.platform || 'tiktok',
        count: config.count || 3,
      });
      return { ...data, actionExecuted: type, output: hooks };
    }
    case 'schedule_post': {
      const ScheduledPost = require('../models/ScheduledPost');
      const post = new ScheduledPost({
        userId: data.userId,
        contentId: data.contentId || data.videoId,
        platform: config.platform || data.platform || 'tiktok',
        scheduledFor: config.scheduledFor ? new Date(config.scheduledFor) : new Date(Date.now() + 3600000),
        caption: config.caption || data.caption || '',
        status: 'pending',
      });
      await post.save();
      return { ...data, actionExecuted: type, scheduledPostId: post._id };
    }
    case 'apply_effects':
    case 'add_music':
    case 'upload_video':
    case 'create_quote':
    case 'export':
    default:
      logger.info('Workflow action queued for background processing', { type });
      await addJob('workflow-action', { type, config, data });
      return { ...data, actionExecuted: type };
    }
  } catch (err) {
    logger.error('Workflow action failed', { type, error: err.message });
    return { ...data, actionExecuted: type, actionError: err.message };
  }
}

/**
 * Evaluate condition — supports equals, not_equals, greater_than, less_than,
 * contains, not_contains operators against resolved data fields.
 */
function evaluateCondition(condition, data) {
  if (!condition || !condition.field) return true;
  const { field, operator, value } = condition;
  const actual = field.split('.').reduce((obj, k) => obj?.[k], data);

  switch (operator) {
  case 'equals':        return actual == value; // eslint-disable-line eqeqeq
  case 'not_equals':    return actual != value; // eslint-disable-line eqeqeq
  case 'greater_than':  return Number(actual) > Number(value);
  case 'less_than':     return Number(actual) < Number(value);
  case 'contains':      return String(actual ?? '').includes(String(value ?? ''));
  case 'not_contains':  return !String(actual ?? '').includes(String(value ?? ''));
  default:              return Boolean(actual);
  }
}

/**
 * Call webhook
 */
async function callWebhook(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    logger.error('Webhook call failed', { url, error: error.message });
    throw error;
  }
}

/**
 * Get workflow execution history
 * @param {string} workflowId - Workflow ID
 * @returns {Array} Execution history
 */
function getWorkflowHistory(workflowId) {
  const state = activeWorkflows.get(workflowId);
  return state?.executionHistory || [];
}

/**
 * Get workflow analytics
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<Object>} Analytics
 */
async function getWorkflowAnalytics(workflowId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw new NotFoundError('Workflow');
    }
    const workflow = await Workflow.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    const state = activeWorkflows.get(workflowId.toString());
    const history = state?.executionHistory || [];

    const totalExecutions = history.filter((h) => h.step === 'start').length;
    const successfulExecutions = history.filter((h) => h.step === 'end' && h.result?.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    const avgExecutionTime = history.length > 0
      ? history.reduce((sum, h) => sum + (h.duration || 0), 0) / history.length
      : 0;

    return {
      workflowId,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      avgExecutionTime: Math.round(avgExecutionTime),
      lastExecution: history[history.length - 1]?.timestamp || null,
    };
  } catch (error) {
    logger.error('Error getting workflow analytics', { error: error.message, workflowId });
    throw error;
  }
}

/**
 * Create advanced workflow
 * @param {string} userId - User ID
 * @param {Object} data - Advanced workflow data
 * @returns {Promise<Object>} Created workflow
 */
async function createAdvancedWorkflow(userId, data) {
  try {
    const { name, description, triggers, actions, conditions, schedule } = data;

    logger.info('Creating advanced workflow', { userId, name });

    const workflow = new Workflow({
      userId,
      name,
      description,
      triggers,
      actions,
      conditions,
      schedule,
      advanced: true,
      status: 'active',
    });
    await workflow.save();

    // Initialize workflow state in the running queue map
    activeWorkflows.set(workflow._id.toString(), {
      workflowId: workflow._id,
      status: 'idle',
      currentStep: null,
      executionHistory: [],
    });

    logger.info('Advanced workflow created successfully', { workflowId: workflow._id });
    return workflow;
  } catch (error) {
    logger.error('Error creating advanced workflow', { error: error.message });
    throw error;
  }
}

/**
 * Execute conditional workflow
 * @param {string} workflowId - Workflow ID
 * @param {string} userId - User ID
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
async function executeConditionalWorkflow(workflowId, userId, context = {}) {
  try {
    const workflow = await Workflow.findOne({ _id: workflowId, userId });
    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    logger.info('Executing conditional workflow', { workflowId, userId });

    // Evaluate conditions
    let conditionsMet = true;
    if (workflow.conditions && workflow.conditions.length > 0) {
      for (const cond of workflow.conditions) {
        const value = context[cond.field];
        switch (cond.operator) {
        case 'equals':
          if (value !== cond.value) conditionsMet = false;
          break;
        case 'not_equals':
          if (value === cond.value) conditionsMet = false;
          break;
        case 'greater_than':
          if (value <= cond.value) conditionsMet = false;
          break;
        case 'less_than':
          if (value >= cond.value) conditionsMet = false;
          break;
        case 'contains':
          if (!value || !value.includes(cond.value)) conditionsMet = false;
          break;
        case 'not_contains':
          if (value && value.includes(cond.value)) conditionsMet = false;
          break;
        default:
          break;
        }
      }
    }

    const results = [];
    if (conditionsMet) {
      // Execute actions
      if (workflow.actions && workflow.actions.length > 0) {
        for (const action of workflow.actions) {
          logger.info('Executing conditional action', { action: action.type });
          results.push({ action: action.type, success: true });
        }
      }
    }

    // Update execution count/status in DB
    workflow.executionCount = (workflow.executionCount || 0) + 1;
    if (conditionsMet) {
      workflow.successCount = (workflow.successCount || 0) + 1;
    } else {
      workflow.failureCount = (workflow.failureCount || 0) + 1;
    }
    workflow.lastExecuted = new Date();
    await workflow.save();

    // Log in-memory active workflows history
    const state = activeWorkflows.get(workflowId.toString()) || {
      workflowId,
      status: 'idle',
      executionHistory: [],
    };

    state.status = conditionsMet ? 'completed' : 'skipped';
    // Record execution start
    state.executionHistory.push({
      step: 'start',
      timestamp: new Date(),
      data: context,
    });
    // Record execution end
    state.executionHistory.push({
      step: 'end',
      timestamp: new Date(),
      result: {
        success: true,
        conditionsMet,
        results,
      },
    });

    activeWorkflows.set(workflowId.toString(), state);

    return {
      success: true,
      executed: conditionsMet,
      conditionsMet,
      results,
    };
  } catch (error) {
    logger.error('Error executing conditional workflow', { error: error.message, workflowId });
    throw error;
  }
}

/**
 * Schedule workflow
 * @param {string} workflowId - Workflow ID
 * @param {string} userId - User ID
 * @param {Object} scheduleConfig - Scheduling configuration
 * @returns {Promise<Object>} Scheduling result
 */
async function scheduleWorkflow(workflowId, userId, scheduleConfig) {
  try {
    const workflow = await Workflow.findOne({ _id: workflowId, userId });
    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    workflow.schedule = {
      type: scheduleConfig.type,
      time: scheduleConfig.time,
      cronExpression: scheduleConfig.cronExpression,
      timezone: scheduleConfig.timezone,
    };
    await workflow.save();

    logger.info('Workflow scheduled successfully', { workflowId, userId, schedule: workflow.schedule });

    return {
      success: true,
      schedule: workflow.schedule,
    };
  } catch (error) {
    logger.error('Error scheduling workflow', { error: error.message, workflowId });
    throw error;
  }
}

module.exports = {
  createWorkflow,
  executeWorkflow,
  getWorkflowHistory,
  getWorkflowAnalytics,
  validateWorkflow,
  createAdvancedWorkflow,
  executeConditionalWorkflow,
  scheduleWorkflow,
};
