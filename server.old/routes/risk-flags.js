// Risk Flag Routes
// Automated risk detection and management

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  detectRiskFlags,
  getRiskFlags,
  getAllRiskFlags,
  acknowledgeRiskFlag,
  resolveRiskFlag
} = require('../services/riskFlagService');
const {
  calculateRiskScore,
  predictFutureRisks,
  getRiskTrends,
  getRiskDashboard,
  automatedRemediation
} = require('../services/riskAnalyticsService');
const router = express.Router();

/**
 * POST /api/risk-flags/detect/:clientId
 * Detect risk flags for client
 */
router.post('/detect/:clientId', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  
  const flags = await detectRiskFlags(userId, clientId);
  sendSuccess(res, 'Risk flags detected', 200, { flags });
}));

/**
 * GET /api/risk-flags/:clientId
 * Get risk flags for client
 */
router.get('/:clientId', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const { status, severity, riskType } = req.query;
  
  const flags = await getRiskFlags(userId, clientId, {
    status: status || null,
    severity: severity || null,
    riskType: riskType || null
  });
  
  sendSuccess(res, 'Risk flags retrieved', 200, { flags });
}));

/**
 * GET /api/risk-flags
 * Get all risk flags for user
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status = 'active', severity, riskType } = req.query;
  
  const flags = await getAllRiskFlags(userId, {
    status,
    severity: severity || null,
    riskType: riskType || null
  });
  
  sendSuccess(res, 'Risk flags retrieved', 200, { flags });
}));

/**
 * POST /api/risk-flags/:flagId/acknowledge
 * Acknowledge risk flag
 */
router.post('/:flagId/acknowledge', auth, asyncHandler(async (req, res) => {
  const { flagId } = req.params;
  const userId = req.user._id;
  
  const flag = await acknowledgeRiskFlag(flagId, userId);
  sendSuccess(res, 'Risk flag acknowledged', 200, flag);
}));

/**
 * POST /api/risk-flags/:flagId/resolve
 * Resolve risk flag
 */
router.post('/:flagId/resolve', auth, asyncHandler(async (req, res) => {
  const { flagId } = req.params;
  const userId = req.user._id;
  const { resolutionNotes, resolutionActions } = req.body;
  
  const flag = await resolveRiskFlag(flagId, userId, resolutionNotes, resolutionActions);
  sendSuccess(res, 'Risk flag resolved', 200, flag);
}));

/**
 * GET /api/risk-flags/:clientId/score
 * Calculate risk score for client
 */
router.get('/:clientId/score', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  
  const score = await calculateRiskScore(userId, clientId);
  sendSuccess(res, 'Risk score calculated', 200, score);
}));

/**
 * GET /api/risk-flags/:clientId/predict
 * Predict future risks
 */
router.get('/:clientId/predict', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const { horizon = 30 } = req.query;
  
  const predictions = await predictFutureRisks(userId, clientId, parseInt(horizon));
  sendSuccess(res, 'Risks predicted', 200, predictions);
}));

/**
 * GET /api/risk-flags/:clientId/trends
 * Get risk trends
 */
router.get('/:clientId/trends', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { clientId } = req.params;
  const { period = 'month' } = req.query;
  
  const trends = await getRiskTrends(userId, clientId, period);
  sendSuccess(res, 'Risk trends retrieved', 200, trends);
}));

/**
 * GET /api/risk-flags/dashboard
 * Get risk dashboard
 */
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const dashboard = await getRiskDashboard(userId);
  sendSuccess(res, 'Risk dashboard retrieved', 200, dashboard);
}));

/**
 * POST /api/risk-flags/:flagId/remediate
 * Automated remediation
 */
router.post('/:flagId/remediate', auth, asyncHandler(async (req, res) => {
  const { flagId } = req.params;
  const result = await automatedRemediation(flagId);
  sendSuccess(res, 'Remediation applied', 200, result);
}));

module.exports = router;

