// Integration Service
// Third-party integration management

const Integration = require('../models/Integration');
const IntegrationMarketplace = require('../models/IntegrationMarketplace');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Get marketplace integrations
 */
async function getMarketplaceIntegrations(category = null, search = null) {
  try {
    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const integrations = await IntegrationMarketplace.find(query)
      .sort({ 'stats.installs': -1, 'stats.rating': -1 })
      .lean();

    return integrations;
  } catch (error) {
    logger.error('Error getting marketplace integrations', { error: error.message });
    throw error;
  }
}

/**
 * Install integration from marketplace
 */
async function installIntegration(userId, marketplaceId, config) {
  try {
    const marketplace = await IntegrationMarketplace.findById(marketplaceId);
    if (!marketplace || !marketplace.isActive) {
      throw new Error('Integration not available');
    }

    // Create integration instance
    const integration = new Integration({
      userId,
      type: marketplace.category,
      provider: marketplace.provider,
      name: marketplace.name,
      description: marketplace.description,
      config: {
        ...config,
        baseUrl: marketplace.api.baseUrl,
        authType: marketplace.authType
      },
      mappings: {},
      metadata: {
        version: marketplace.version || '1.0.0',
        category: marketplace.category,
        marketplaceId: marketplace._id
      },
      status: 'active'
    });

    // Test connection
    const health = await testIntegrationConnection(integration);
    integration.health = health;

    if (health.status === 'down') {
      integration.status = 'error';
    }

    await integration.save();

    // Update marketplace stats
    marketplace.stats.installs = (marketplace.stats.installs || 0) + 1;
    await marketplace.save();

    logger.info('Integration installed', { userId, integrationId: integration._id, provider: marketplace.provider });
    return integration;
  } catch (error) {
    logger.error('Error installing integration', { error: error.message, userId });
    throw error;
  }
}

/**
 * Test integration connection
 */
async function testIntegrationConnection(integration) {
  try {
    const startTime = Date.now();
    
    // Make test API call based on integration type
    let testUrl = integration.config.baseUrl;
    
    switch (integration.type) {
      case 'cms':
        testUrl += '/api/health';
        break;
      case 'dam':
        testUrl += '/api/v1/health';
        break;
      case 'crm':
        testUrl += '/api/status';
        break;
      default:
        testUrl += '/health';
    }

    const headers = getAuthHeaders(integration);

    const response = await axios.get(testUrl, {
      headers,
      timeout: 5000,
      validateStatus: () => true
    });

    const responseTime = Date.now() - startTime;
    const status = response.status >= 200 && response.status < 300 ? 'healthy' : 
                   response.status >= 400 && response.status < 500 ? 'degraded' : 'down';

    return {
      lastCheck: new Date(),
      status,
      responseTime,
      errorMessage: status !== 'healthy' ? `HTTP ${response.status}` : null
    };
  } catch (error) {
    return {
      lastCheck: new Date(),
      status: 'down',
      responseTime: null,
      errorMessage: error.message
    };
  }
}

/**
 * Get authentication headers
 */
function getAuthHeaders(integration) {
  const headers = { 'Content-Type': 'application/json' };

  switch (integration.config.authType) {
    case 'api_key':
      if (integration.config.apiKey) {
        headers['X-API-Key'] = integration.config.apiKey;
      }
      break;
    case 'bearer':
      if (integration.config.apiKey) {
        headers['Authorization'] = `Bearer ${integration.config.apiKey}`;
      }
      break;
    case 'basic':
      if (integration.config.apiKey && integration.config.apiSecret) {
        const credentials = Buffer.from(`${integration.config.apiKey}:${integration.config.apiSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
    case 'oauth':
      if (integration.config.credentials?.accessToken) {
        headers['Authorization'] = `Bearer ${integration.config.credentials.accessToken}`;
      }
      break;
  }

  return headers;
}

/**
 * Sync content to integration
 */
async function syncContentToIntegration(integrationId, content, direction = 'push') {
  try {
    const integration = await Integration.findById(integrationId);
    if (!integration || integration.status !== 'active') {
      throw new Error('Integration not active');
    }

    if (direction === 'push') {
      return await pushContentToIntegration(integration, content);
    } else if (direction === 'pull') {
      return await pullContentFromIntegration(integration);
    }
  } catch (error) {
    logger.error('Error syncing content', { error: error.message, integrationId });
    throw error;
  }
}

/**
 * Push content to integration
 */
async function pushContentToIntegration(integration, content) {
  try {
    const headers = getAuthHeaders(integration);
    const payload = mapContentToIntegration(content, integration.mappings);

    let endpoint = '/api/content';
    switch (integration.type) {
      case 'cms':
        endpoint = '/api/posts';
        break;
      case 'dam':
        endpoint = '/api/assets';
        break;
      case 'crm':
        endpoint = '/api/activities';
        break;
    }

    const url = `${integration.config.baseUrl}${endpoint}`;
    const response = await axios.post(url, payload, { headers });

    // Update sync status
    integration.sync.lastSync = new Date();
    await integration.save();

    return {
      success: true,
      externalId: response.data.id || response.data._id,
      syncedAt: new Date()
    };
  } catch (error) {
    logger.error('Error pushing content to integration', { error: error.message });
    throw error;
  }
}

/**
 * Map content to integration format
 */
function mapContentToIntegration(content, mappings) {
  const mapped = {};

  if (mappings?.content) {
    mapped.title = content.title || content[mappings.content.title] || '';
    mapped.body = content.content?.text || content[mappings.content.body] || '';
    mapped.tags = content.tags || content[mappings.content.tags] || [];
    mapped.metadata = content.metadata || {};
  } else {
    // Default mapping
    mapped.title = content.title || '';
    mapped.body = content.content?.text || '';
    mapped.tags = content.tags || [];
    mapped.metadata = content.metadata || {};
  }

  return mapped;
}

/**
 * Pull content from integration
 */
async function pullContentFromIntegration(integration) {
  try {
    const headers = getAuthHeaders(integration);
    
    let endpoint = '/api/content';
    switch (integration.type) {
      case 'cms':
        endpoint = '/api/posts';
        break;
      case 'dam':
        endpoint = '/api/assets';
        break;
    }

    const url = `${integration.config.baseUrl}${endpoint}`;
    const response = await axios.get(url, { headers });

    // Update sync status
    integration.sync.lastSync = new Date();
    await integration.save();

    return {
      success: true,
      content: response.data,
      syncedAt: new Date()
    };
  } catch (error) {
    logger.error('Error pulling content from integration', { error: error.message });
    throw error;
  }
}

/**
 * Check integration health
 */
async function checkIntegrationHealth(integrationId) {
  try {
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const health = await testIntegrationConnection(integration);
    integration.health = health;

    if (health.status === 'down') {
      integration.status = 'error';
    } else if (integration.status === 'error' && health.status === 'healthy') {
      integration.status = 'active';
    }

    await integration.save();
    return health;
  } catch (error) {
    logger.error('Error checking integration health', { error: error.message, integrationId });
    throw error;
  }
}

/**
 * Get popular integrations
 */
async function getPopularIntegrations(limit = 10) {
  try {
    const integrations = await IntegrationMarketplace.find({ isActive: true })
      .sort({ 'stats.installs': -1, 'stats.rating': -1 })
      .limit(limit)
      .lean();

    return integrations;
  } catch (error) {
    logger.error('Error getting popular integrations', { error: error.message });
    throw error;
  }
}

/**
 * Get integration by provider
 */
async function getIntegrationByProvider(provider) {
  try {
    const integration = await IntegrationMarketplace.findOne({ 
      provider, 
      isActive: true 
    }).lean();

    return integration;
  } catch (error) {
    logger.error('Error getting integration by provider', { error: error.message, provider });
    throw error;
  }
}

/**
 * Create marketplace integration (admin function)
 */
async function createMarketplaceIntegration(integrationData) {
  try {
    const {
      provider,
      name,
      description,
      category,
      logo,
      website,
      documentation,
      authType,
      features = [],
      api = {},
      config = {},
      pricing = {}
    } = integrationData;

    if (!provider || !name || !description || !category || !authType) {
      throw new Error('Required fields missing');
    }

    const integration = new IntegrationMarketplace({
      provider,
      name,
      description,
      category,
      logo,
      website,
      documentation,
      authType,
      features,
      api,
      config,
      pricing,
      isActive: true,
      isVerified: false
    });

    await integration.save();
    logger.info('Marketplace integration created', { provider, integrationId: integration._id });
    return integration;
  } catch (error) {
    logger.error('Error creating marketplace integration', { error: error.message });
    throw error;
  }
}

/**
 * Sync content to all active integrations
 */
async function syncContentToAllIntegrations(userId, content, direction = 'push') {
  try {
    const integrations = await Integration.find({
      userId,
      status: 'active',
      'sync.enabled': true
    }).lean();

    const results = [];

    for (const integration of integrations) {
      try {
        const result = await syncContentToIntegration(integration._id, content, direction);
        results.push({
          integrationId: integration._id,
          provider: integration.provider,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          integrationId: integration._id,
          provider: integration.provider,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error syncing to all integrations', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getMarketplaceIntegrations,
  installIntegration,
  testIntegrationConnection,
  syncContentToIntegration,
  checkIntegrationHealth,
  getPopularIntegrations,
  getIntegrationByProvider,
  createMarketplaceIntegration,
  syncContentToAllIntegrations
};

