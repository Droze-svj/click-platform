const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

// Services
const predictionService = require('../services/predictionService');
const communityAgentService = require('../services/communityAgentService');
const revenueForecastingService = require('../services/revenueForecastingService');
const monetizationService = require('../services/monetizationService');
const governanceLedgerService = require('../services/governanceLedgerService');
const contentComplianceService = require('../services/contentComplianceService');
const syndicateService = require('../services/syndicateService');
const contentRecyclingService = require('../services/contentRecyclingService');
const networkHealthService = require('../services/networkHealthService');
const fiscalAutonomy = require('../services/fiscalAutonomyService');
const arbitrageSteering = require('../services/arbitrageSteeringService');

/**
 * GET /api/click/pulse
 * Real-time community sentiment resonance
 */
router.get('/pulse', auth, asyncHandler(async (req, res) => {
  const status = await communityAgentService.getStatus(req.user.id);
  res.json(status);
}));

/**
 * GET /api/click/network-health
 * Audits global distribution network integrity (Phase 24)
 */
router.get('/network-health', auth, asyncHandler(async (req, res) => {
  const health = await networkHealthService.auditAllSocialConnections(req.user.id);
  res.json(health);
}));

/**
 * GET /api/click/forecast
 * Spectral revenue projection (Phase 21)
 */
router.get('/forecast', auth, asyncHandler(async (req, res) => {
  const forecast = await revenueForecastingService.generateClickForecast(req.user.id, req.user.workspaceId);
  res.json(forecast);
}));

/**
 * GET /api/click/ledger
 * Recent governance decisions (Phase 22)
 */
router.get('/ledger', auth, asyncHandler(async (req, res) => {
  const actions = await governanceLedgerService.getRecentActions(req.user.id);
  res.json(actions);
}));

/**
 * POST /api/click/syndicate-consensus
 * Multi-agent council debate (Phase 23)
 */
router.post('/syndicate-consensus', auth, asyncHandler(async (req, res) => {
  const result = await syndicateService.getCouncilConsensus(req.user.id, req.body.proposal);
  res.json(result);
}));

/**
 * POST /api/click/compliance-audit
 * Regional legal/cultural check (Phase 22)
 */
router.post('/compliance-audit', auth, asyncHandler(async (req, res) => {
  const { contentId, transcript, region } = req.body;
  const audit = await contentComplianceService.auditContentForRegion(req.user.id, contentId, transcript, region);
  res.json(audit);
}));

/**
 * GET /api/click/arbitrage-triggers
 * Detect emergent cultural trends (Phase 23)
 */
router.get('/arbitrage-triggers', auth, asyncHandler(async (req, res) => {
  const trends = await predictionService.detectCulturalEmergence(req.user.id);
  res.json(trends);
}));

/**
 * GET /api/click/resurrection-candidates
 * Scout legacy high-performers (Phase 23)
 */
router.get('/resurrection-candidates', auth, asyncHandler(async (req, res) => {
  const candidates = await contentRecyclingService.scoutForResurrectionCandidates(req.user.id);
  res.json(candidates);
}));

/**
 * POST /api/click/trigger-resurrection
 * Deploy legacy content to emergent trend (Phase 23)
 */
router.post('/trigger-resurrection', auth, asyncHandler(async (req, res) => {
  const { originalPostId } = req.body;
  const result = await contentRecyclingService.createRecyclingPlan(req.user.id, originalPostId, {
    autoSchedule: true,
    repostSchedule: { frequency: 'daily', maxReposts: 1 }
  });
  res.json(result);
}));

/**
 * POST /api/click/yield-pivot
 * Manually trigger yield optimization check (Phase 21)
 */
router.post('/yield-pivot', auth, asyncHandler(async (req, res) => {
  const result = await monetizationService.triggerYieldOptimizationPivot(req.user.id, req.body.contentId);
  res.json(result);
}));

/**
 * GET /api/click/fiscal-velocity
 * Real-time revenue velocity tracking (Phase 25)
 */
router.get('/fiscal-velocity', auth, asyncHandler(async (req, res) => {
  const velocity = await fiscalAutonomy.calculateFiscalVelocity(req.user.id);
  res.json(velocity);
}));

/**
 * GET /api/click/monetization-nodes
 * Active monetization targets and EPC (Phase 25)
 */
router.get('/monetization-nodes', auth, asyncHandler(async (req, res) => {
  const steer = await arbitrageSteering.getSteeringManifest();
  res.json(steer.manifest);
}));

module.exports = router;
