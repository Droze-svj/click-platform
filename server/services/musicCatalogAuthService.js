// Music Catalog Authentication Service
// Handles authentication flow for catalog access

const logger = require('../utils/logger');
const { registerUserSession, validateProviderAccess } = require('./musicProviderAuthService');

/**
 * Authenticate user for catalog access
 */
async function authenticateCatalogAccess(userId) {
  try {
    const MusicProviderConfig = require('../models/MusicProviderConfig');
    const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');

    // Get enabled providers
    const licensedProviders = await MusicProviderConfig.find({ enabled: true })
      .select('provider')
      .lean();
    const aiProviders = await AIMusicProviderConfig.find({ enabled: true })
      .select('provider')
      .lean();

    const allProviders = [
      ...licensedProviders.map(p => ({ name: p.provider, type: 'licensed' })),
      ...aiProviders.map(p => ({ name: p.provider, type: 'ai' }))
    ];

    // Validate access for each provider
    const authResults = await Promise.allSettled(
      allProviders.map(async ({ name, type }) => {
        try {
          const hasAccess = await validateProviderAccess(name, userId, type);
          return { provider: name, type, authenticated: hasAccess };
        } catch (error) {
          logger.warn('Provider authentication failed', {
            provider: name,
            userId,
            error: error.message
          });
          return { provider: name, type, authenticated: false, error: error.message };
        }
      })
    );

    const authenticatedProviders = authResults
      .filter(result => result.status === 'fulfilled' && result.value.authenticated)
      .map(result => result.value);

    return {
      authenticated: authenticatedProviders.length > 0,
      providers: authenticatedProviders,
      totalProviders: allProviders.length
    };
  } catch (error) {
    logger.error('Error authenticating catalog access', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Ensure user session is registered before catalog operations
 */
async function ensureCatalogAccess(userId) {
  try {
    const auth = await authenticateCatalogAccess(userId);
    
    if (!auth.authenticated) {
      throw new Error('No authenticated music providers available');
    }

    return auth;
  } catch (error) {
    logger.error('Error ensuring catalog access', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  authenticateCatalogAccess,
  ensureCatalogAccess
};







