// System Settings Service

const { getOrSet, set, get } = require('./cacheService');
const logger = require('../utils/logger');

// System settings (in production, store in database)
const systemSettings = {
  maintenance: {
    enabled: false,
    message: 'System is under maintenance',
    startTime: null,
    endTime: null,
  },
  registration: {
    enabled: true,
    requireEmailVerification: true,
    allowSSO: true,
  },
  features: {
    videoProcessing: true,
    contentGeneration: true,
    socialPosting: true,
    analytics: true,
  },
  limits: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxContentLength: 100000,
    maxVideosPerUser: 1000,
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@click.com',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@click.com',
  },
  storage: {
    provider: process.env.AWS_S3_BUCKET ? 's3' : 'local',
    maxStoragePerUser: 10 * 1024 * 1024 * 1024, // 10GB
  },
};

/**
 * Get system settings
 */
async function getSystemSettings() {
  try {
    const cacheKey = 'system:settings';
    
    return await getOrSet(cacheKey, async () => {
      // In production, fetch from database
      return systemSettings;
    }, 300); // Cache for 5 minutes
  } catch (error) {
    logger.error('Get system settings error', { error: error.message });
    return systemSettings;
  }
}

/**
 * Update system settings
 */
async function updateSystemSettings(updates) {
  try {
    // In production, save to database
    Object.assign(systemSettings, updates);

    // Invalidate cache
    await set('system:settings', systemSettings, 300);

    logger.info('System settings updated', { updates: Object.keys(updates) });
    return systemSettings;
  } catch (error) {
    logger.error('Update system settings error', { error: error.message });
    throw error;
  }
}

/**
 * Enable maintenance mode
 */
async function enableMaintenanceMode(message, startTime, endTime) {
  try {
    await updateSystemSettings({
      maintenance: {
        enabled: true,
        message: message || 'System is under maintenance',
        startTime: startTime || new Date(),
        endTime: endTime || null,
      },
    });

    logger.info('Maintenance mode enabled', { message, startTime, endTime });
    return { success: true };
  } catch (error) {
    logger.error('Enable maintenance mode error', { error: error.message });
    throw error;
  }
}

/**
 * Disable maintenance mode
 */
async function disableMaintenanceMode() {
  try {
    await updateSystemSettings({
      maintenance: {
        enabled: false,
        message: '',
        startTime: null,
        endTime: null,
      },
    });

    logger.info('Maintenance mode disabled');
    return { success: true };
  } catch (error) {
    logger.error('Disable maintenance mode error', { error: error.message });
    throw error;
  }
}

/**
 * Check if feature is enabled
 */
async function isFeatureEnabled(feature) {
  try {
    const settings = await getSystemSettings();
    return settings.features[feature] !== false;
  } catch (error) {
    logger.error('Check feature enabled error', { error: error.message, feature });
    return true; // Default to enabled
  }
}

/**
 * Get user limits
 */
async function getUserLimits() {
  try {
    const settings = await getSystemSettings();
    return settings.limits;
  } catch (error) {
    logger.error('Get user limits error', { error: error.message });
    return systemSettings.limits;
  }
}

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  enableMaintenanceMode,
  disableMaintenanceMode,
  isFeatureEnabled,
  getUserLimits,
};






