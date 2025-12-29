// OAuth Health Check Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { checkAllConnections, refreshExpiredTokens } = require('../../services/oauthHealthCheck');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

/**
 * GET /api/oauth/health
 * Check health of all OAuth connections
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const health = await checkAllConnections(req.user._id);
  sendSuccess(res, 'OAuth health check completed', 200, health);
}));

/**
 * POST /api/oauth/health/refresh
 * Refresh expired OAuth tokens
 */
router.post('/refresh', auth, asyncHandler(async (req, res) => {
  const results = await refreshExpiredTokens(req.user._id);
  sendSuccess(res, 'Token refresh completed', 200, results);
}));

module.exports = router;




