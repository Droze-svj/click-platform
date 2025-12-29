// Music Licensing Sync Routes (Admin)

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  syncProviderCatalog,
  syncAllProviders,
  syncSpecificTracks,
  checkExpiredLicenses
} = require('../services/musicLicensingSync');
const router = express.Router();

// Middleware to check admin access
const requireAdmin = (req, res, next) => {
  // Add your admin check logic here
  next();
};

/**
 * @route POST /api/admin/music-licensing/sync/:provider
 * @desc Sync catalog from a specific provider
 * @access Private (Admin)
 */
router.post('/sync/:provider', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { maxTracks, genres, moods, updateExisting } = req.body;

  try {
    const result = await syncProviderCatalog(provider, {
      maxTracks: maxTracks || 1000,
      genres: genres || [],
      moods: moods || [],
      updateExisting: updateExisting !== false
    });

    sendSuccess(res, 'Catalog sync completed', 200, result);
  } catch (error) {
    logger.error('Error syncing catalog', { error: error.message, provider });
    sendError(res, error.message || 'Failed to sync catalog', 500);
  }
}));

/**
 * @route POST /api/admin/music-licensing/sync/all
 * @desc Sync all enabled providers
 * @access Private (Admin)
 */
router.post('/sync/all', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { maxTracks } = req.body;

  try {
    const result = await syncAllProviders({
      maxTracks: maxTracks || 1000
    });

    sendSuccess(res, 'All providers synced', 200, result);
  } catch (error) {
    logger.error('Error syncing all providers', { error: error.message });
    sendError(res, error.message || 'Failed to sync providers', 500);
  }
}));

/**
 * @route POST /api/admin/music-licensing/sync/tracks
 * @desc Sync specific tracks
 * @access Private (Admin)
 */
router.post('/sync/tracks', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { provider, trackIds } = req.body;

  if (!provider || !trackIds || !Array.isArray(trackIds)) {
    return sendError(res, 'Provider and trackIds array are required', 400);
  }

  try {
    const results = await syncSpecificTracks(provider, trackIds);

    sendSuccess(res, 'Tracks synced', 200, { results });
  } catch (error) {
    logger.error('Error syncing tracks', { error: error.message, provider });
    sendError(res, error.message || 'Failed to sync tracks', 500);
  }
}));

/**
 * @route POST /api/admin/music-licensing/check-expired
 * @desc Check and update expired licenses
 * @access Private (Admin)
 */
router.post('/check-expired', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await checkExpiredLicenses();

    sendSuccess(res, 'Expired licenses checked', 200, result);
  } catch (error) {
    logger.error('Error checking expired licenses', { error: error.message });
    sendError(res, error.message || 'Failed to check expired licenses', 500);
  }
}));

module.exports = router;







