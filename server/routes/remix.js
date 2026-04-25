const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { getRemixDiscover, remixProject } = require('../services/remixService');
const router = express.Router();

/**
 * GET /api/remix/discover
 * Get featured templates for the Remix Hub
 */
router.get('/discover', auth, asyncHandler(async (req, res) => {
  const templates = await getRemixDiscover(req.user._id, req.query);
  sendSuccess(res, 'Remix discovery data fetched', 200, templates);
}));

/**
 * POST /api/remix/clone/:id
 * Clone a template into user's library
 */
router.post('/clone/:id', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.body;
  const content = await remixProject(req.user._id, req.params.id, workspaceId);
  sendSuccess(res, 'Project remixed successfully', 201, content);
}));

module.exports = router;
