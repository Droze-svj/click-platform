// Advanced Audience Insights Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  getAudienceInsights,
  predictAudienceBehavior,
  createAudiencePersonas,
  analyzeAudienceSentiment,
  identifyInfluencers,
  analyzeAudienceRetention,
  getCrossPlatformAnalysis
} = require('../services/advancedAudienceInsightsService');
const {
  createAudienceAlert,
  checkAudienceAlerts,
  getUserAlerts,
  toggleAlert,
  deleteAlert
} = require('../services/audienceAlertService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * GET /api/audience/insights
 * Get comprehensive audience insights
 */
router.get('/insights', auth, asyncHandler(async (req, res) => {
  const { period = 90, platform = null } = req.query;

  const insights = await getAudienceInsights(req.user._id, {
    period: parseInt(period),
    platform: platform || null
  });

  sendSuccess(res, 'Audience insights retrieved', 200, insights);
}));

/**
 * GET /api/audience/predict
 * Predict future audience behavior
 */
router.get('/predict', auth, asyncHandler(async (req, res) => {
  const { period = 90, forecastDays = 30 } = req.query;

  const prediction = await predictAudienceBehavior(req.user._id, {
    period: parseInt(period),
    forecastDays: parseInt(forecastDays)
  });

  sendSuccess(res, 'Behavior predicted', 200, prediction);
}));

/**
 * GET /api/audience/personas
 * Create audience personas
 */
router.get('/personas', auth, asyncHandler(async (req, res) => {
  const { period = 90, minSegments = 3, maxSegments = 5 } = req.query;

  const personas = await createAudiencePersonas(req.user._id, {
    period: parseInt(period),
    minSegments: parseInt(minSegments),
    maxSegments: parseInt(maxSegments)
  });

  sendSuccess(res, 'Personas created', 200, personas);
}));

/**
 * GET /api/audience/sentiment
 * Analyze audience sentiment
 */
router.get('/sentiment', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;

  const sentiment = await analyzeAudienceSentiment(req.user._id, {
    period: parseInt(period)
  });

  sendSuccess(res, 'Sentiment analyzed', 200, sentiment);
}));

/**
 * GET /api/audience/influencers
 * Identify top influencers/engagers
 */
router.get('/influencers', auth, asyncHandler(async (req, res) => {
  const { period = 90, topN = 10 } = req.query;

  const influencers = await identifyInfluencers(req.user._id, {
    period: parseInt(period),
    topN: parseInt(topN)
  });

  sendSuccess(res, 'Influencers identified', 200, influencers);
}));

/**
 * GET /api/audience/retention
 * Analyze audience retention
 */
router.get('/retention', auth, asyncHandler(async (req, res) => {
  const { period = 90 } = req.query;

  const retention = await analyzeAudienceRetention(req.user._id, {
    period: parseInt(period)
  });

  sendSuccess(res, 'Retention analyzed', 200, retention);
}));

/**
 * GET /api/audience/cross-platform
 * Get cross-platform deep analysis
 */
router.get('/cross-platform', auth, asyncHandler(async (req, res) => {
  const { period = 90 } = req.query;

  const analysis = await getCrossPlatformAnalysis(req.user._id, {
    period: parseInt(period)
  });

  sendSuccess(res, 'Cross-platform analysis completed', 200, analysis);
}));

/**
 * POST /api/audience/alerts
 * Create audience alert
 */
router.post('/alerts', auth, asyncHandler(async (req, res) => {
  const alert = await createAudienceAlert(req.user._id, req.body);
  sendSuccess(res, 'Alert created', 201, alert);
}));

/**
 * GET /api/audience/alerts
 * Get user's alerts
 */
router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const alerts = await getUserAlerts(req.user._id);
  sendSuccess(res, 'Alerts retrieved', 200, { alerts });
}));

/**
 * POST /api/audience/alerts/:id/toggle
 * Toggle alert
 */
router.post('/alerts/:id/toggle', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const alert = await toggleAlert(id, req.user._id, isActive);
  sendSuccess(res, 'Alert updated', 200, alert);
}));

/**
 * DELETE /api/audience/alerts/:id
 * Delete alert
 */
router.delete('/alerts/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteAlert(id, req.user._id);
  sendSuccess(res, 'Alert deleted', 200);
}));

module.exports = router;

