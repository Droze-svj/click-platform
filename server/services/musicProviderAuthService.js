// Music Provider Authentication Service
// Handles user/session registration with music providers

const logger = require('../utils/logger');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');

/**
 * Register user session with provider (if required)
 */
async function registerUserSession(providerName, userId, sessionType = 'licensed') {
  try {
    let config;
    
    if (sessionType === 'licensed') {
      config = await MusicProviderConfig.findOne({ provider: providerName, enabled: true }).lean();
    } else if (sessionType === 'ai') {
      config = await AIMusicProviderConfig.findOne({ provider: providerName, enabled: true }).lean();
    } else {
      throw new Error('Invalid session type');
    }

    if (!config) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    // Check if provider requires user registration
    // Some providers need user-specific tokens/sessions
    const requiresRegistration = config.settings?.requiresUserRegistration || false;

    if (!requiresRegistration) {
      // Provider uses platform-level authentication
      return {
        authenticated: true,
        usesPlatformAuth: true,
        sessionToken: null
      };
    }

    // Register user with provider API
    const sessionToken = await registerUserWithProvider(providerName, userId, config);

    return {
      authenticated: true,
      usesPlatformAuth: false,
      sessionToken
    };
  } catch (error) {
    logger.error('Error registering user session', {
      error: error.message,
      provider: providerName,
      userId
    });
    throw error;
  }
}

/**
 * Register user with provider API
 */
async function registerUserWithProvider(providerName, userId, config) {
  const axios = require('axios');

  try {
    // Example: Soundstripe user registration
    if (providerName === 'soundstripe') {
      const response = await axios.post(
        `${config.apiBaseUrl || 'https://api.soundstripe.com/v1'}/users/register`,
        {
          platform_user_id: userId.toString(),
          platform_name: 'click',
          license_type: config.licenseType || 'commercial'
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.session_token || response.data.user_token;
    }

    // Example: Artlist user registration
    if (providerName === 'artlist') {
      const response = await axios.post(
        `${config.apiBaseUrl || 'https://api.artlist.io/v2'}/users/register`,
        {
          external_user_id: userId.toString(),
          license_type: config.licenseType || 'commercial'
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'X-API-Key': config.apiKey
          }
        }
      );

      return response.data.session_token;
    }

    // Default: use platform API key
    return null;
  } catch (error) {
    logger.error('Error registering user with provider', {
      error: error.message,
      provider: providerName,
      userId
    });
    
    // If registration fails but not required, fall back to platform auth
    if (!config.settings?.requiresUserRegistration) {
      return null;
    }
    
    throw error;
  }
}

/**
 * Get authentication headers for provider API call
 */
async function getProviderAuthHeaders(providerName, userId, sessionType = 'licensed') {
  try {
    const session = await registerUserSession(providerName, userId, sessionType);
    
    let config;
    if (sessionType === 'licensed') {
      config = await MusicProviderConfig.findOne({ provider: providerName }).lean();
    } else {
      config = await AIMusicProviderConfig.findOne({ provider: providerName }).lean();
    }

    if (!config) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    const headers = {};

    if (session.usesPlatformAuth) {
      // Use platform API key
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      if (config.apiSecret) {
        headers['X-API-Secret'] = config.apiSecret;
      }
    } else {
      // Use user session token
      headers['Authorization'] = `Bearer ${session.sessionToken}`;
      headers['X-Platform-Key'] = config.apiKey; // Some providers need both
    }

    // Provider-specific headers
    if (providerName === 'soundstripe') {
      headers['Content-Type'] = 'application/json';
    } else if (providerName === 'artlist') {
      headers['X-API-Key'] = config.apiKey;
    }

    return headers;
  } catch (error) {
    logger.error('Error getting provider auth headers', {
      error: error.message,
      provider: providerName,
      userId
    });
    throw error;
  }
}

/**
 * Validate provider access for user
 */
async function validateProviderAccess(providerName, userId, sessionType = 'licensed') {
  try {
    const session = await registerUserSession(providerName, userId, sessionType);
    return session.authenticated;
  } catch (error) {
    logger.warn('Provider access validation failed', {
      error: error.message,
      provider: providerName,
      userId
    });
    return false;
  }
}

module.exports = {
  registerUserSession,
  getProviderAuthHeaders,
  validateProviderAccess
};







