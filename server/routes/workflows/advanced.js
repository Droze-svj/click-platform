// Advanced Workflow Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  createAdvancedWorkflow,
  executeConditionalWorkflow,
  scheduleWorkflow,
  getWorkflowAnalytics,
} = require('../../services/advancedWorkflowService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const {
  ValidationError,
} = require('../../utils/errorHandler');
const router = express.Router();

router.post('/create', auth, asyncHandler(async (req, res) => {
  const { name, description, triggers, actions, conditions, schedule } = req.body;
  if (!name || !triggers || !actions) {
    throw new ValidationError('Name, triggers, and actions are required', [
      { field: 'name', message: 'Name is required' },
      { field: 'triggers', message: 'At least one trigger is required' },
      { field: 'actions', message: 'At least one action is required' },
    ]);
  }
  
  const workflow = await createAdvancedWorkflow(req.user._id, {
    name,
    description,
    triggers,
    actions,
    conditions,
    schedule,
  });
  sendSuccess(res, 'Advanced workflow created', 200, workflow);
}));

router.post('/:workflowId/execute', auth, asyncHandler(async (req, res) => {
  const { workflowId } = req.params;
  const { context } = req.body;
  try {
    const result = await executeConditionalWorkflow(workflowId, req.user._id, context || {});
    sendSuccess(res, 'Workflow executed', 200, result);
  } catch (error) {
    logger.error('Execute conditional workflow error', { error: error.message, workflowId });
    sendError(res, error.message, 500);
  }
}));

router.post('/:workflowId/schedule', auth, asyncHandler(async (req, res) => {
  const { workflowId } = req.params;
  const { scheduleConfig } = req.body;
  if (!scheduleConfig) {
    return sendError(res, 'Schedule config is required', 400);
  }
  try {
    const result = await scheduleWorkflow(workflowId, req.user._id, scheduleConfig);
    sendSuccess(res, 'Workflow scheduled', 200, result);
  } catch (error) {
    logger.error('Schedule workflow error', { error: error.message, workflowId });
    sendError(res, error.message, 500);
  }
}));

router.get('/:workflowId/analytics', auth, asyncHandler(async (req, res) => {
  const { workflowId } = req.params;
  try {
    const analytics = await getWorkflowAnalytics(workflowId, req.user._id);
    sendSuccess(res, 'Workflow analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get workflow analytics error', { error: error.message, workflowId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

