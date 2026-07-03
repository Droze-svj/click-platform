// Advanced Workflow Automation Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const advancedWorkflowService = require('../../services/advancedWorkflowService');
const { getUserIdFromReq } = require('../../utils/userId');
const Workflow = require('../../models/Workflow');
const logger = require('../../utils/logger');

// IDOR guard for :workflowId routes. executeWorkflow / getWorkflowHistory /
// getWorkflowAnalytics all resolve the workflow (or its in-memory run state) by
// bare id with no owner scope, so a caller could run — or read the history and
// analytics of — ANOTHER tenant's workflow by guessing its id. Confirm the
// caller owns it first. Workflow.userId is the canonical hex (getUserIdFromReq),
// the same value the /create route writes.
async function requireWorkflowOwner(req, res, next) {
  try {
    const owned = await Workflow.exists({ _id: req.params.workflowId, userId: getUserIdFromReq(req) });
    if (!owned) return sendError(res, 'Workflow not found', 404);
    return next();
  } catch (_) {
    return sendError(res, 'Workflow not found', 404);
  }
}

/**
 * POST /api/workflows/advanced-automation/create
 * Create workflow from visual definition
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    // Canonical hex — this is WRITTEN as Workflow.userId (a flip-set field), so a
    // raw Supabase UUID here would fragment the user's workflows (and CastError
    // once Workflow.userId becomes ObjectId). See docs/userid-objectid-flip-runbook.md.
    const userId = getUserIdFromReq(req);
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
router.post('/:workflowId/execute', authenticate, requireWorkflowOwner, async (req, res) => {
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
router.get('/:workflowId/history', authenticate, requireWorkflowOwner, async (req, res) => {
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
router.get('/:workflowId/analytics', authenticate, requireWorkflowOwner, async (req, res) => {
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
