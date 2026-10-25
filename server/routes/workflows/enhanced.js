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
  try {
    const workflow = await createWorkflow(req.user._id, req.body || {});
    sendSuccess(res, 'Workflow created successfully', 201, workflow);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    if (err.name === 'ValidationError') return sendError(res, err.message, 400);
    throw err;
  }
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
  const { context } = req.body || {};
  try {
    const result = await executeWorkflow(req.user._id, workflowId, context && typeof context === 'object' ? context : {});
    sendSuccess(res, 'Workflow executed', 200, result);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    throw err;
  }
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
  const userId = req.user._id || req.user.id;
  
  // In development mode, return empty array for dev users
  if (process.env.NODE_ENV !== 'production' && userId && userId.toString().startsWith('dev-')) {
    return sendSuccess(res, 'Workflow suggestions fetched', 200, []);
  }

  const suggestions = await getWorkflowSuggestions(userId);
  sendSuccess(res, 'Workflow suggestions fetched', 200, suggestions);
}));

module.exports = router;







