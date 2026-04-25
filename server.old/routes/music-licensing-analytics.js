// Music Licensing Analytics Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  getUsageAnalytics,
  getComplianceMetrics,
  getProviderMetrics
} = require('../services/musicLicensingAnalytics');
const { getCacheStats } = require('../services/musicLicensingCache');
const { getRateLimitStatus } = require('../services/musicLicensingRateLimiter');
const router = express.Router();

/**
 * @route GET /api/music-licensing/analytics/usage
 * @desc Get usage analytics
 * @access Private
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate, provider, groupBy } = req.query;

  try {
    const analytics = await getUsageAnalytics({
      startDate,
      endDate,
      provider,
      groupBy: groupBy || 'day'
    });

    sendSuccess(res, 'Usage analytics retrieved', 200, analytics);
  } catch (error) {
    logger.error('Error getting usage analytics', { error: error.message });
    sendError(res, error.message || 'Failed to get usage analytics', 500);
  }
}));

/**
 * @route GET /api/music-licensing/analytics/compliance
 * @desc Get compliance metrics
 * @access Private
 */
router.get('/compliance', auth, asyncHandler(async (req, res) => {
  try {
    const metrics = await getComplianceMetrics();

    sendSuccess(res, 'Compliance metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Error getting compliance metrics', { error: error.message });
    sendError(res, error.message || 'Failed to get compliance metrics', 500);
  }
}));

/**
 * @route GET /api/music-licensing/analytics/providers
 * @desc Get provider metrics
 * @access Private
 */
router.get('/providers', auth, asyncHandler(async (req, res) => {
  try {
    const metrics = await getProviderMetrics();

    sendSuccess(res, 'Provider metrics retrieved', 200, { providers: metrics });
  } catch (error) {
    logger.error('Error getting provider metrics', { error: error.message });
    sendError(res, error.message || 'Failed to get provider metrics', 500);
  }
}));

/**
 * @route GET /api/music-licensing/analytics/cache
 * @desc Get cache statistics
 * @access Private
 */
router.get('/cache', auth, asyncHandler(async (req, res) => {
  try {
    const stats = getCacheStats();

    sendSuccess(res, 'Cache statistics retrieved', 200, stats);
  } catch (error) {
    logger.error('Error getting cache stats', { error: error.message });
    sendError(res, error.message || 'Failed to get cache stats', 500);
  }
}));

/**
 * @route GET /api/music-licensing/analytics/rate-limits
 * @desc Get rate limit status for all providers
 * @access Private
 */
router.get('/rate-limits', auth, asyncHandler(async (req, res) => {
  try {
    const MusicProviderConfig = require('../models/MusicProviderConfig');
    const providers = await MusicProviderConfig.find({ enabled: true }).lean();

    const rateLimits = providers.map(provider => {
      const status = getRateLimitStatus(provider.provider);
      return status || {
        provider: provider.provider,
        error: 'No rate limit data available'
      };
    });

    sendSuccess(res, 'Rate limit status retrieved', 200, { rateLimits });
  } catch (error) {
    logger.error('Error getting rate limit status', { error: error.message });
    sendError(res, error.message || 'Failed to get rate limit status', 500);
  }
}));

module.exports = router;







