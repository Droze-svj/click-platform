// Load Balancer Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  healthCheckServers,
  selectServerRoundRobin,
  selectServerLeastConnections,
  selectServerWeighted,
  getLoadBalancerStatus,
  autoScale,
} = require('../../services/loadBalancingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/health', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const health = await healthCheckServers();
    sendSuccess(res, 'Server health checked', 200, health);
  } catch (error) {
    logger.error('Health check servers error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/status', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const status = getLoadBalancerStatus();
    sendSuccess(res, 'Load balancer status fetched', 200, status);
  } catch (error) {
    logger.error('Get load balancer status error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/select-server', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { strategy = 'weighted' } = req.query;
  try {
    let server;
    if (strategy === 'round-robin') {
      server = selectServerRoundRobin();
    } else if (strategy === 'least-connections') {
      server = selectServerLeastConnections();
    } else {
      server = selectServerWeighted();
    }

    if (!server) {
      return sendError(res, 'No healthy servers available', 503);
    }

    sendSuccess(res, 'Server selected', 200, { server, strategy });
  } catch (error) {
    logger.error('Select server error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/auto-scale', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await autoScale();
    sendSuccess(res, 'Auto-scale checked', 200, result);
  } catch (error) {
    logger.error('Auto-scale error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






