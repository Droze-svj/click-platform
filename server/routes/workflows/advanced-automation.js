// Advanced Workflow Automation Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const advancedWorkflowService = require('../../services/advancedWorkflowService');
const logger = require('../../utils/logger');

/**
 * POST /api/workflows/advanced-automation/create
 * Create workflow from visual definition
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowDefinition = { ...req.body, userId };

    const workflow = await advancedWorkflowService.createWorkflow(workflowDefinition);
    return sendSuccess(res, workflow, 'Workflow created successfully');
  } catch (error) {
    logger.error('Error creating workflow', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/workflows/advanced-automation/:workflowId/execute
 * Execute workflow
 */
router.post('/:workflowId/execute', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { inputData = {} } = req.body;

    const result = await advancedWorkflowService.executeWorkflow(workflowId, inputData);
    return sendSuccess(res, result, 'Workflow executed successfully');
  } catch (error) {
    logger.error('Error executing workflow', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/workflows/advanced-automation/:workflowId/history
 * Get workflow execution history
 */
router.get('/:workflowId/history', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const history = advancedWorkflowService.getWorkflowHistory(workflowId);
    return sendSuccess(res, { history });
  } catch (error) {
    logger.error('Error getting workflow history', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/workflows/advanced-automation/:workflowId/analytics
 * Get workflow analytics
 */
router.get('/:workflowId/analytics', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const analytics = await advancedWorkflowService.getWorkflowAnalytics(workflowId);
    return sendSuccess(res, analytics);
  } catch (error) {
    logger.error('Error getting workflow analytics', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
