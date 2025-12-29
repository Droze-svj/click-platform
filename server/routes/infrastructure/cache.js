// Intelligent Cache Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { intelligentCache, initIntelligentCache } = require('../../services/intelligentCacheService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.post('/invalidate', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { pattern, cascade } = req.body;
  if (!pattern) {
    return sendError(res, 'Pattern is required', 400);
  }
  try {
    const result = await intelligentCache.invalidate(pattern, { cascade: cascade !== false });
    sendSuccess(res, 'Cache invalidated', 200, result);
  } catch (error) {
    logger.error('Invalidate cache error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = intelligentCache.getStats();
    sendSuccess(res, 'Cache stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get cache stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/warm', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { keys, fetcher } = req.body;
  if (!keys || !Array.isArray(keys)) {
    return sendError(res, 'Keys array is required', 400);
  }
  try {
    // In production, fetcher would be a function reference
    const result = await intelligentCache.warmCache(keys, async (key) => {
      // Placeholder fetcher
      return { data: `cached-${key}` };
    });
    sendSuccess(res, 'Cache warmed', 200, result);
  } catch (error) {
    logger.error('Warm cache error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






