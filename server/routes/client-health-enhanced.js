// Enhanced Client Health Routes
// Forecasting, alerts, monitoring, recommendations, automated detection

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { forecastClientHealth } = require('../services/healthForecastingService');
const { checkHealthAlerts, getActiveAlerts } = require('../services/healthAlertService');
const { addCompetitor, syncCompetitorMetrics, syncAllCompetitors } = require('../services/competitorMonitoringService');
const { generateHealthRecommendations } = require('../services/healthRecommendationService');
const { detectKeyWins } = require('../services/automatedWinDetectionService');
const { analyzeAdvancedSentiment, getSentimentTrendsByTopic } = require('../services/advancedSentimentService');
const router = express.Router();

/**
 * POST /api/clients/:clientWorkspaceId/health-score/forecast
 * Forecast client health score
 */
router.post('/:clientWorkspaceId/health-score/forecast', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { days = 30 } = req.body;

  const forecast = await forecastClientHealth(clientWorkspaceId, days);
  sendSuccess(res, 'Health score forecast generated', 200, forecast);
}));

/**
 * POST /api/clients/:clientWorkspaceId/health-alerts/check
 * Check and create health alerts
 */
router.post('/:clientWorkspaceId/health-alerts/check', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId } = req.body;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const alerts = await checkHealthAlerts(clientWorkspaceId, agencyWorkspaceId);
  sendSuccess(res, 'Health alerts checked', 200, { alerts });
}));

/**
 * GET /api/clients/:clientWorkspaceId/health-alerts
 * Get active health alerts
 */
router.get('/:clientWorkspaceId/health-alerts', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const alerts = await getActiveAlerts(clientWorkspaceId, req.query);
  sendSuccess(res, 'Active alerts retrieved', 200, { alerts });
}));

/**
 * POST /api/workspaces/:workspaceId/competitors
 * Add competitor for monitoring
 */
router.post('/:workspaceId/competitors', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { clientWorkspaceId, ...competitorData } = req.body;

  if (!clientWorkspaceId) {
    return sendError(res, 'Client workspace ID is required', 400);
  }

  const competitor = await addCompetitor(workspaceId, clientWorkspaceId, competitorData);
  sendSuccess(res, 'Competitor added for monitoring', 201, competitor);
}));

/**
 * POST /api/competitors/:competitorId/sync
 * Sync competitor metrics
 */
router.post('/:competitorId/sync', auth, asyncHandler(async (req, res) => {
  const { competitorId } = req.params;
  const metrics = await syncCompetitorMetrics(competitorId);
  sendSuccess(res, 'Competitor metrics synced', 200, metrics);
}));

/**
 * POST /api/competitors/sync-all
 * Sync all competitors
 */
router.post('/sync-all', auth, asyncHandler(async (req, res) => {
  const result = await syncAllCompetitors();
  sendSuccess(res, 'All competitors synced', 200, result);
}));

/**
 * GET /api/clients/:clientWorkspaceId/health/recommendations
 * Get health improvement recommendations
 */
router.get('/:clientWorkspaceId/health/recommendations', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const recommendations = await generateHealthRecommendations(clientWorkspaceId, req.query);
  sendSuccess(res, 'Health recommendations retrieved', 200, recommendations);
}));

/**
 * POST /api/clients/:clientWorkspaceId/key-wins/detect
 * Automatically detect key wins
 */
router.post('/:clientWorkspaceId/key-wins/detect', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { workspaceId, agencyWorkspaceId, ...filters } = req.body;

  if (!workspaceId || !agencyWorkspaceId) {
    return sendError(res, 'Workspace ID and agency workspace ID are required', 400);
  }

  const result = await detectKeyWins(workspaceId, clientWorkspaceId, agencyWorkspaceId, filters);
  sendSuccess(res, 'Key wins detected', 200, result);
}));

/**
 * POST /api/comments/advanced-sentiment
 * Advanced sentiment analysis
 */
router.post('/advanced-sentiment', auth, asyncHandler(async (req, res) => {
  const { text, ...options } = req.body;

  if (!text) {
    return sendError(res, 'Text is required', 400);
  }

  const analysis = await analyzeAdvancedSentiment(text, options);
  sendSuccess(res, 'Advanced sentiment analyzed', 200, analysis);
}));

/**
 * GET /api/workspaces/:workspaceId/sentiment/topics
 * Get sentiment trends by topic
 */
router.get('/:workspaceId/sentiment/topics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const trends = await getSentimentTrendsByTopic(workspaceId, req.query);
  sendSuccess(res, 'Sentiment trends by topic retrieved', 200, trends);
}));

module.exports = router;


