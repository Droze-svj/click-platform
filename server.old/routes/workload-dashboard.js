// Workload Dashboard Routes
// Workload and efficiency dashboards

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { getWorkloadDashboard, getAggregatedDashboard } = require('../services/workloadDashboardService');
const { compareClients, forecastWorkload, getTeamWorkloadDistribution } = require('../services/workloadAnalyticsService');
const router = express.Router();

/**
 * GET /api/workload/:clientId
 * Get workload dashboard for client
 */
router.get('/:clientId', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const { period = 'month' } = req.query;

  const dashboard = await getWorkloadDashboard(userId, clientId, period);
  sendSuccess(res, 'Workload dashboard retrieved', 200, dashboard);
}));

/**
 * GET /api/workload
 * Get aggregated dashboard for all clients
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = 'month' } = req.query;

  const dashboard = await getAggregatedDashboard(userId, period);
  sendSuccess(res, 'Aggregated dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/workload/compare
 * Compare clients
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientIds, period = 'month' } = req.body;

  if (!clientIds || !Array.isArray(clientIds) || clientIds.length < 2) {
    return sendError(res, 'At least 2 client IDs are required', 400);
  }

  const comparison = await compareClients(userId, clientIds, period);
  sendSuccess(res, 'Clients compared', 200, comparison);
}));

/**
 * GET /api/workload/:clientId/forecast
 * Forecast workload
 */
router.get('/:clientId/forecast', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const { periods = 3 } = req.query;

  const forecast = await forecastWorkload(userId, clientId, parseInt(periods));
  sendSuccess(res, 'Workload forecast retrieved', 200, forecast);
}));

/**
 * GET /api/workload/team/distribution
 * Get team workload distribution
 */
router.get('/team/distribution', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = 'month' } = req.query;

  const distribution = await getTeamWorkloadDistribution(userId, period);
  sendSuccess(res, 'Team distribution retrieved', 200, distribution);
}));

module.exports = router;

