// Enhanced workflow routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  createWorkflow,
  executeWorkflow,
  getWorkflowSuggestions
} = require('../../services/enhancedWorkflowService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/workflows/enhanced:
 *   post:
 *     summary: Create a new workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const workflow = await createWorkflow(req.user._id, req.body);
  sendSuccess(res, 'Workflow created successfully', 201, workflow);
}));

/**
 * @swagger
 * /api/workflows/enhanced/{workflowId}/execute:
 *   post:
 *     summary: Execute a workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:workflowId/execute', auth, asyncHandler(async (req, res) => {
  const { workflowId } = req.params;
  const { context } = req.body;
  const result = await executeWorkflow(req.user._id, workflowId, context);
  sendSuccess(res, 'Workflow executed', 200, result);
}));

/**
 * @swagger
 * /api/workflows/enhanced/suggestions:
 *   get:
 *     summary: Get workflow suggestions
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const suggestions = await getWorkflowSuggestions(req.user._id);
  sendSuccess(res, 'Workflow suggestions fetched', 200, suggestions);
}));

module.exports = router;







