// Workflow routes

const express = require('express');
const Workflow = require('../models/Workflow');
const auth = require('../middleware/auth');
const {
  trackAction,
  getSuggestedNextSteps,
  getUserPreferences,
  executeWorkflow,
  saveWorkflowFromActions
} = require('../services/workflowService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/workflows/suggestions:
 *   get:
 *     summary: Get suggested next steps
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  try {
    const { currentAction } = req.query;
    const suggestions = await getSuggestedNextSteps(req.user._id, currentAction);
    sendSuccess(res, 'Suggestions fetched', 200, suggestions || []);
  } catch (error) {
    logger.error('Error fetching workflow suggestions', { error: error.message, userId: req.user._id });
    sendSuccess(res, 'Suggestions fetched', 200, []);
  }
}));

/**
 * @swagger
 * /api/workflows/preferences:
 *   get:
 *     summary: Get user preferences from history
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/preferences', auth, asyncHandler(async (req, res) => {
  const preferences = await getUserPreferences(req.user._id);
  sendSuccess(res, 'Preferences fetched', 200, preferences);
}));

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: Get user workflows
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { template = false } = req.query;
  const query = { userId: req.user._id, isActive: true };
  
  if (template === 'true') {
    query.isTemplate = true;
  }

  const workflows = await Workflow.find(query)
    .sort({ frequency: -1, lastUsed: -1 })
    .limit(50);

  sendSuccess(res, 'Workflows fetched', 200, workflows);
}));

/**
 * @swagger
 * /api/workflows:
 *   post:
 *     summary: Create workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, description, steps, isTemplate, tags } = req.body;

  if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
    return sendError(res, 'Name and steps are required', 400);
  }

  const workflow = new Workflow({
    userId: req.user._id,
    name,
    description,
    steps: steps.map((step, index) => ({
      order: index + 1,
      action: step.action,
      config: step.config || {},
      conditions: step.conditions || {}
    })),
    isTemplate: isTemplate || false,
    tags: tags || []
  });

  await workflow.save();

  // Track workflow creation
  await trackAction(req.user._id, 'create_workflow', {
    workflowId: workflow._id,
    workflowName: name
  });

  sendSuccess(res, 'Workflow created', 201, workflow);
}));

/**
 * @swagger
 * /api/workflows/{workflowId}/execute:
 *   post:
 *     summary: Execute workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:workflowId/execute', auth, asyncHandler(async (req, res) => {
  const { workflowId } = req.params;
  const inputData = req.body.data || {};

  const result = await executeWorkflow(workflowId, req.user._id, inputData);

  sendSuccess(res, 'Workflow executed', 200, result);
}));

/**
 * @swagger
 * /api/workflows/{workflowId}:
 *   put:
 *     summary: Update workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:workflowId', auth, asyncHandler(async (req, res) => {
  const workflow = await Workflow.findOne({
    _id: req.params.workflowId,
    userId: req.user._id
  });

  if (!workflow) {
    return sendError(res, 'Workflow not found', 404);
  }

  if (req.body.name) workflow.name = req.body.name;
  if (req.body.description !== undefined) workflow.description = req.body.description;
  if (req.body.steps) {
    workflow.steps = req.body.steps.map((step, index) => ({
      order: index + 1,
      action: step.action,
      config: step.config || {},
      conditions: step.conditions || {}
    }));
  }
  if (req.body.tags) workflow.tags = req.body.tags;

  await workflow.save();

  sendSuccess(res, 'Workflow updated', 200, workflow);
}));

/**
 * @swagger
 * /api/workflows/{workflowId}:
 *   delete:
 *     summary: Delete workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:workflowId', auth, asyncHandler(async (req, res) => {
  const workflow = await Workflow.findOne({
    _id: req.params.workflowId,
    userId: req.user._id
  });

  if (!workflow) {
    return sendError(res, 'Workflow not found', 404);
  }

  workflow.isActive = false;
  await workflow.save();

  sendSuccess(res, 'Workflow deleted', 200);
}));

/**
 * @swagger
 * /api/workflows/from-actions:
 *   post:
 *     summary: Create workflow from action history
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/from-actions', auth, asyncHandler(async (req, res) => {
  const { name, actionIds } = req.body;

  if (!name || !actionIds || !Array.isArray(actionIds)) {
    return sendError(res, 'Name and actionIds array are required', 400);
  }

  const workflow = await saveWorkflowFromActions(req.user._id, name, actionIds);

  sendSuccess(res, 'Workflow created from actions', 201, workflow);
}));

/**
 * @swagger
 * /api/workflows/track:
 *   post:
 *     summary: Track user action
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/track', auth, asyncHandler(async (req, res) => {
  const { action, metadata = {} } = req.body;

  if (!action) {
    return sendError(res, 'Action is required', 400);
  }

  await trackAction(req.user._id, action, {
    ...metadata,
    sessionId: req.headers['x-session-id'],
    page: metadata.page || req.headers['referer']
  });

  sendSuccess(res, 'Action tracked', 200);
}));

module.exports = router;







