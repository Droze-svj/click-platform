// Music License Registration Service
// Registers license usage with provider APIs when required

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const { getProviderAuthHeaders } = require('./musicProviderAuthService');

/**
 * Register license usage with provider API
 */
async function registerLicenseUsage(usageLogId, options = {}) {
  try {
    const usageLog = await MusicLicenseUsage.findById(usageLogId);

    if (!usageLog) {
      throw new Error('Usage log not found');
    }

    // Check if registration is required
    if (!requiresProviderRegistration(usageLog.licenseType)) {
      return {
        registered: false,
        reason: 'Registration not required for this license type'
      };
    }

    // Check if already registered
    if (usageLog.providerLicenseRegistered) {
      return {
        registered: true,
        providerLicenseId: usageLog.providerLicenseId,
        alreadyRegistered: true
      };
    }

    // Get provider configuration
    const providerConfig = await MusicProviderConfig.findOne({
      provider: usageLog.provider,
      enabled: true
    });

    if (!providerConfig) {
      throw new Error(`Provider ${usageLog.provider} not configured`);
    }

    // Register with provider API
    const registrationResult = await registerWithProvider(
      usageLog,
      providerConfig,
      options
    );

    // Update usage log
    usageLog.providerLicenseRegistered = true;
    usageLog.providerLicenseId = registrationResult.licenseId;
    usageLog.providerRegistrationResponse = registrationResult.response;
    await usageLog.save();

    logger.info('License usage registered with provider', {
      usageLogId,
      provider: usageLog.provider,
      licenseId: registrationResult.licenseId
    });

    return {
      registered: true,
      providerLicenseId: registrationResult.licenseId,
      response: registrationResult.response
    };
  } catch (error) {
    logger.error('Error registering license usage', {
      error: error.message,
      usageLogId
    });

    // Update usage log with error
    const usageLog = await MusicLicenseUsage.findById(usageLogId);
    if (usageLog) {
      usageLog.complianceStatus = 'failed';
      usageLog.complianceNotes = error.message;
      await usageLog.save();
    }

    throw error;
  }
}

/**
 * Check if provider registration is required
 */
function requiresProviderRegistration(licenseType) {
  // Registration required for per-export and per-end-user licenses
  return licenseType === 'per_export' || licenseType === 'per_end_user';
}

/**
 * Register with provider API
 */
async function registerWithProvider(usageLog, providerConfig, options = {}) {
  const axios = require('axios');
  const User = require('../models/User');
  const user = await User.findById(usageLog.userId).lean();

  try {
    const authHeaders = await getProviderAuthHeaders(
      usageLog.provider,
      usageLog.userId.toString(),
      'licensed'
    );

    let registrationResult;

    switch (usageLog.provider) {
      case 'soundstripe':
        registrationResult = await registerSoundstripeUsage(
          usageLog,
          providerConfig,
          authHeaders,
          user,
          options
        );
        break;

      case 'artlist':
        registrationResult = await registerArtlistUsage(
          usageLog,
          providerConfig,
          authHeaders,
          user,
          options
        );
        break;

      case 'hooksounds':
        registrationResult = await registerHookSoundsUsage(
          usageLog,
          providerConfig,
          authHeaders,
          user,
          options
        );
        break;

      default:
        throw new Error(`Unsupported provider: ${usageLog.provider}`);
    }

    return registrationResult;
  } catch (error) {
    logger.error('Error registering with provider', {
      error: error.message,
      provider: usageLog.provider
    });
    throw error;
  }
}

/**
 * Register Soundstripe usage
 */
async function registerSoundstripeUsage(usageLog, providerConfig, authHeaders, user, options) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      `${providerConfig.apiBaseUrl || 'https://api.soundstripe.com/v1'}/licenses/register`,
      {
        track_id: usageLog.providerTrackId,
        user_id: user.email || user._id.toString(),
        export_id: usageLog.renderId,
        export_format: usageLog.exportFormat,
        export_platform: usageLog.exportPlatform,
        timestamp: usageLog.renderTimestamp.toISOString()
      },
      {
        headers: authHeaders
      }
    );

    return {
      licenseId: response.data.license_id || response.data.id,
      response: response.data
    };
  } catch (error) {
    logger.error('Soundstripe registration error', {
      error: error.message,
      usageLogId: usageLog._id
    });
    throw error;
  }
}

/**
 * Register Artlist usage
 */
async function registerArtlistUsage(usageLog, providerConfig, authHeaders, user, options) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      `${providerConfig.apiBaseUrl || 'https://api.artlist.io/v2'}/licenses/register`,
      {
        track_id: usageLog.providerTrackId,
        user_email: user.email,
        export_id: usageLog.renderId,
        export_timestamp: usageLog.renderTimestamp.toISOString()
      },
      {
        headers: authHeaders
      }
    );

    return {
      licenseId: response.data.license_id || response.data.id,
      response: response.data
    };
  } catch (error) {
    logger.error('Artlist registration error', {
      error: error.message,
      usageLogId: usageLog._id
    });
    throw error;
  }
}

/**
 * Register HookSounds usage
 */
async function registerHookSoundsUsage(usageLog, providerConfig, authHeaders, user, options) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      `${providerConfig.apiBaseUrl || 'https://api.hooksounds.com/v1'}/licenses/register`,
      {
        track_id: usageLog.providerTrackId,
        user_id: user._id.toString(),
        export_id: usageLog.renderId,
        export_timestamp: usageLog.renderTimestamp.toISOString()
      },
      {
        headers: authHeaders
      }
    );

    return {
      licenseId: response.data.license_id || response.data.id,
      response: response.data
    };
  } catch (error) {
    logger.error('HookSounds registration error', {
      error: error.message,
      usageLogId: usageLog._id
    });
    throw error;
  }
}

/**
 * Batch register multiple usage logs
 */
async function batchRegisterLicenseUsage(usageLogIds, options = {}) {
  try {
    const results = {
      registered: [],
      failed: [],
      skipped: []
    };

    for (const usageLogId of usageLogIds) {
      try {
        const result = await registerLicenseUsage(usageLogId, options);

        if (result.registered) {
          results.registered.push({
            usageLogId,
            providerLicenseId: result.providerLicenseId
          });
        } else {
          results.skipped.push({
            usageLogId,
            reason: result.reason
          });
        }
      } catch (error) {
        results.failed.push({
          usageLogId,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in batch license registration', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  registerLicenseUsage,
  batchRegisterLicenseUsage,
  requiresProviderRegistration
};







