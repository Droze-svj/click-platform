// Music Catalog Sync Routes (Admin)

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  syncCatalogFromProviders,
  incrementalSync,
  fullSync
} = require('../services/musicCatalogSync');
const router = express.Router();

/**
 * @route POST /api/admin/music-catalog/sync
 * @desc Sync catalog from providers
 * @access Private (Admin)
 */
router.post('/sync', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { providers, fullSync: full = false, maxTracks = 1000 } = req.body;

  try {
    const result = await syncCatalogFromProviders({
      providers: providers || null,
      fullSync: full,
      maxTracks: parseInt(maxTracks)
    });

    sendSuccess(res, 'Catalog sync completed', 200, result);
  } catch (error) {
    logger.error('Error syncing catalog', { error: error.message });
    sendError(res, error.message || 'Failed to sync catalog', 500);
  }
}));

/**
 * @route POST /api/admin/music-catalog/sync/incremental
 * @desc Incremental catalog sync
 * @access Private (Admin)
 */
router.post('/sync/incremental', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { providers } = req.body;

  try {
    const result = await incrementalSync(providers || null);

    sendSuccess(res, 'Incremental sync completed', 200, result);
  } catch (error) {
    logger.error('Error in incremental sync', { error: error.message });
    sendError(res, error.message || 'Failed to run incremental sync', 500);
  }
}));

/**
 * @route POST /api/admin/music-catalog/sync/full
 * @desc Full catalog sync
 * @access Private (Admin)
 */
router.post('/sync/full', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { providers } = req.body;

  try {
    const result = await fullSync(providers || null);

    sendSuccess(res, 'Full sync completed', 200, result);
  } catch (error) {
    logger.error('Error in full sync', { error: error.message });
    sendError(res, error.message || 'Failed to run full sync', 500);
  }
}));

module.exports = router;

