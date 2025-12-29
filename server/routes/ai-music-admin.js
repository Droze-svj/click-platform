// AI Music Generation Admin Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
const router = express.Router();

// Middleware to check admin access
const requireAdmin = (req, res, next) => {
  // Add your admin check logic here
  next();
};

/**
 * @route POST /api/admin/ai-music/provider
 * @desc Configure AI music provider
 * @access Private (Admin)
 */
router.post('/provider', auth, requireAdmin, asyncHandler(async (req, res) => {
  const {
    provider,
    apiKey,
    apiSecret,
    licenseType,
    enterpriseLicense,
    allowsCommercialUse = true,
    allowsSocialPlatforms = true,
    supportedPlatforms = ['all'],
    allowsMonetization = true,
    allowsSaaSIntegration = false, // Must be explicitly enabled
    requiresAttribution = false,
    apiBaseUrl,
    rateLimit
  } = req.body;

  if (!provider || !apiKey) {
    return sendError(res, 'Provider and API key are required', 400);
  }

  // Validate provider
  const validProviders = ['mubert', 'soundraw'];
  if (!validProviders.includes(provider)) {
    return sendError(res, 'Invalid provider', 400);
  }

  // Validate license type
  const validLicenseTypes = ['free', 'commercial', 'enterprise'];
  if (licenseType && !validLicenseTypes.includes(licenseType)) {
    return sendError(res, 'Invalid license type', 400);
  }

  try {
    let config = await AIMusicProviderConfig.findOne({ provider });

    if (config) {
      // Update existing
      config.apiKey = apiKey;
      if (apiSecret) config.apiSecret = apiSecret;
      if (licenseType) config.licenseType = licenseType;
      config.enterpriseLicense = enterpriseLicense !== undefined ? enterpriseLicense : config.enterpriseLicense;
      config.allowsCommercialUse = allowsCommercialUse;
      config.allowsSocialPlatforms = allowsSocialPlatforms;
      config.supportedPlatforms = supportedPlatforms;
      config.allowsMonetization = allowsMonetization;
      config.allowsSaaSIntegration = allowsSaaSIntegration;
      config.requiresAttribution = requiresAttribution;
      if (apiBaseUrl) config.apiBaseUrl = apiBaseUrl;
      if (rateLimit) config.rateLimit = rateLimit;
      config.enabled = true;
    } else {
      // Create new
      config = new AIMusicProviderConfig({
        provider,
        apiKey,
        apiSecret,
        licenseType: licenseType || 'commercial',
        enterpriseLicense: enterpriseLicense || false,
        allowsCommercialUse,
        allowsSocialPlatforms,
        supportedPlatforms,
        allowsMonetization,
        allowsSaaSIntegration,
        requiresAttribution,
        apiBaseUrl,
        rateLimit: rateLimit || {},
        enabled: true
      });
    }

    await config.save();

    logger.info('AI music provider configured', {
      provider,
      licenseType: config.licenseType,
      allowsSaaSIntegration: config.allowsSaaSIntegration
    });

    sendSuccess(res, 'Provider configured successfully', 200, {
      provider: config.provider,
      licenseType: config.licenseType,
      allowsCommercialUse: config.allowsCommercialUse,
      allowsSocialPlatforms: config.allowsSocialPlatforms,
      allowsMonetization: config.allowsMonetization,
      allowsSaaSIntegration: config.allowsSaaSIntegration
    });
  } catch (error) {
    logger.error('Error configuring AI music provider', {
      error: error.message,
      provider
    });
    sendError(res, error.message || 'Failed to configure provider', 500);
  }
}));

/**
 * @route GET /api/admin/ai-music/providers
 * @desc Get all AI music provider configurations
 * @access Private (Admin)
 */
router.get('/providers', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const providers = await AIMusicProviderConfig.find().select('-apiKey -apiSecret');

    sendSuccess(res, 'Providers retrieved', 200, {
      providers: providers.map(p => ({
        provider: p.provider,
        licenseType: p.licenseType,
        enterpriseLicense: p.enterpriseLicense,
        allowsCommercialUse: p.allowsCommercialUse,
        allowsSocialPlatforms: p.allowsSocialPlatforms,
        supportedPlatforms: p.supportedPlatforms,
        allowsMonetization: p.allowsMonetization,
        allowsSaaSIntegration: p.allowsSaaSIntegration,
        requiresAttribution: p.requiresAttribution,
        enabled: p.enabled,
        usageCount: p.usageCount,
        lastUsedAt: p.lastUsedAt,
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
 * @route PUT /api/admin/ai-music/provider/:provider/enable
 * @desc Enable/disable provider
 * @access Private (Admin)
 */
router.put('/provider/:provider/enable', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { enabled } = req.body;

  try {
    const config = await AIMusicProviderConfig.findOne({ provider });

    if (!config) {
      return sendError(res, 'Provider not found', 404);
    }

    config.enabled = enabled !== undefined ? enabled : config.enabled;
    await config.save();

    sendSuccess(res, 'Provider updated', 200, {
      provider: config.provider,
      enabled: config.enabled
    });
  } catch (error) {
    logger.error('Error updating provider', {
      error: error.message,
      provider
    });
    sendError(res, error.message || 'Failed to update provider', 500);
  }
}));

module.exports = router;







