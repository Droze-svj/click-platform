// CDN Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  purgeCache,
  getCDNUrl,
  cacheAtEdge,
  getCDNStatus,
} = require('../services/cdnService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/cdn/status:
 *   get:
 *     summary: Get CDN status
 *     tags: [CDN]
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = getCDNStatus();
    sendSuccess(res, 'CDN status fetched', 200, status);
  } catch (error) {
    logger.error('Get CDN status error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/purge:
 *   post:
 *     summary: Purge CDN cache (admin)
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/purge', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { paths } = req.body;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return sendError(res, 'Paths array is required', 400);
  }

  try {
    const result = await purgeCache(paths);
    sendSuccess(res, 'Cache purged', 200, result);
  } catch (error) {
    logger.error('Purge cache error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/url:
 *   get:
 *     summary: Get CDN URL for asset
 *     tags: [CDN]
 */
router.get('/url', asyncHandler(async (req, res) => {
  const { path } = req.query;

  if (!path) {
    return sendError(res, 'Path is required', 400);
  }

  try {
    const cdnUrl = getCDNUrl(path);
    sendSuccess(res, 'CDN URL generated', 200, { url: cdnUrl });
  } catch (error) {
    logger.error('Get CDN URL error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/cache:
 *   post:
 *     summary: Cache at edge (admin)
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cache', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { key, value, ttl = 3600 } = req.body;

  if (!key || value === undefined) {
    return sendError(res, 'Key and value are required', 400);
  }

  try {
    await cacheAtEdge(key, value, ttl);
    sendSuccess(res, 'Cached at edge', 200);
  } catch (error) {
    logger.error('Cache at edge error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






