// Music Licensing Admin Routes
// Configure and manage music licensing providers

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const router = express.Router();

// Middleware to check admin access (you may want to enhance this)
const requireAdmin = (req, res, next) => {
  // Add your admin check logic here
  // For now, just pass through
  next();
};

/**
 * @route POST /api/admin/music-licensing/provider
 * @desc Configure a music licensing provider
 * @access Private (Admin)
 */
router.post('/provider', auth, requireAdmin, asyncHandler(async (req, res) => {
  const {
    provider,
    apiKey,
    apiSecret,
    apiBaseUrl,
    catalogEnabled,
    allowedLicenseTypes,
    settings
  } = req.body;

  try {
    if (!provider || !apiKey) {
      return sendError(res, 'Provider and API key are required', 400);
    }

    // Validate provider
    const validProviders = ['soundstripe', 'artlist', 'hooksounds', 'epidemic_sound', 'audiojungle'];
    if (!validProviders.includes(provider)) {
      return sendError(res, 'Invalid provider', 400);
    }

    // Check if provider already exists
    let config = await MusicProviderConfig.findOne({ provider });

    if (config) {
      // Update existing
      config.apiKey = apiKey;
      if (apiSecret) config.apiSecret = apiSecret;
      if (apiBaseUrl) config.apiBaseUrl = apiBaseUrl;
      config.catalogEnabled = catalogEnabled !== undefined ? catalogEnabled : config.catalogEnabled;
      if (allowedLicenseTypes) config.allowedLicenseTypes = allowedLicenseTypes;
      if (settings) config.settings = settings;
      config.enabled = true;
    } else {
      // Create new
      config = new MusicProviderConfig({
        provider,
        apiKey,
        apiSecret,
        apiBaseUrl,
        catalogEnabled: catalogEnabled !== undefined ? catalogEnabled : false,
        allowedLicenseTypes: allowedLicenseTypes || ['saas_catalog'],
        settings: settings || {},
        enabled: true
      });
    }

    await config.save();

    logger.info('Music provider configured', { provider, catalogEnabled });

    sendSuccess(res, 'Provider configured successfully', 200, {
      provider: config.provider,
      enabled: config.enabled,
      catalogEnabled: config.catalogEnabled,
      allowedLicenseTypes: config.allowedLicenseTypes
    });
  } catch (error) {
    logger.error('Error configuring provider', {
      error: error.message,
      provider,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to configure provider', 500);
  }
}));

/**
 * @route GET /api/admin/music-licensing/providers
 * @desc Get all provider configurations
 * @access Private (Admin)
 */
router.get('/providers', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const providers = await MusicProviderConfig.find().select('-apiKey -apiSecret');

    sendSuccess(res, 'Providers retrieved', 200, {
      providers: providers.map(p => ({
        provider: p.provider,
        enabled: p.enabled,
        catalogEnabled: p.catalogEnabled,
        allowedLicenseTypes: p.allowedLicenseTypes,
        lastSyncedAt: p.lastSyncedAt,
        syncStatus: p.syncStatus,
        lastError: p.lastError,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Error getting providers', { error: error.message });
    sendError(res, error.message || 'Failed to get providers', 500);
  }
}));

/**
 * @route PUT /api/admin/music-licensing/provider/:provider/enable
 * @desc Enable/disable a provider
 * @access Private (Admin)
 */
router.put('/provider/:provider/enable', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { enabled, catalogEnabled } = req.body;

  try {
    const config = await MusicProviderConfig.findOne({ provider });

    if (!config) {
      return sendError(res, 'Provider not found', 404);
    }

    if (enabled !== undefined) config.enabled = enabled;
    if (catalogEnabled !== undefined) config.catalogEnabled = catalogEnabled;

    await config.save();

    sendSuccess(res, 'Provider updated', 200, {
      provider: config.provider,
      enabled: config.enabled,
      catalogEnabled: config.catalogEnabled
    });
  } catch (error) {
    logger.error('Error updating provider', {
      error: error.message,
      provider,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to update provider', 500);
  }
}));

/**
 * @route DELETE /api/admin/music-licensing/provider/:provider
 * @desc Delete provider configuration
 * @access Private (Admin)
 */
router.delete('/provider/:provider', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { provider } = req.params;

  try {
    await MusicProviderConfig.findOneAndDelete({ provider });

    logger.info('Music provider deleted', { provider });

    sendSuccess(res, 'Provider deleted successfully', 200);
  } catch (error) {
    logger.error('Error deleting provider', {
      error: error.message,
      provider,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to delete provider', 500);
  }
}));

module.exports = router;







