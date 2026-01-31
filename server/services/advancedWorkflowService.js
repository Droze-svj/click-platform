// Advanced Workflow Automation Service
// Visual workflow builder, advanced triggers, workflow analytics

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Workflow = require('../models/Workflow');
const { addJob } = require('./jobQueueService');

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
      result: Object.fromEntries(nodeResults),
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
 * Execute action
 */
async function executeAction(action, data) {
  // Would integrate with various services
  logger.info('Executing action', { action: action.type });
  return { ...data, actionExecuted: action.type };
}

/**
 * Evaluate condition
 */
function evaluateCondition(condition, data) {
  // Simple condition evaluation
  // Would support complex expressions
  return true; // Placeholder
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
    const state = activeWorkflows.get(workflowId);
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

module.exports = {
  createWorkflow,
  executeWorkflow,
  getWorkflowHistory,
  getWorkflowAnalytics,
  validateWorkflow,
};
