// KPI Dashboard Routes
// Agency KPI dashboards

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  getAgencyKPIDashboard
} = require('../services/kpiDashboardService');
const router = express.Router();

/**
 * GET /api/agency/:agencyWorkspaceId/kpi-dashboard
 * Get agency KPI dashboard
 */
router.get('/:agencyWorkspaceId/kpi-dashboard', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const dashboard = await getAgencyKPIDashboard(agencyWorkspaceId, req.query);
  sendSuccess(res, 'KPI dashboard retrieved', 200, dashboard);
}));

module.exports = router;


