// Integration Routes
// Integration marketplace and management

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getMarketplaceIntegrations,
  installIntegration,
  syncContentToIntegration,
  checkIntegrationHealth
} = require('../services/integrationService');
const Integration = require('../models/Integration');

const router = express.Router();

/**
 * GET /api/integrations/marketplace
 * Get marketplace integrations
 */
router.get('/marketplace', auth, asyncHandler(async (req, res) => {
  const { category = null, search = null } = req.query;
  const integrations = await getMarketplaceIntegrations(category, search);
  sendSuccess(res, 'Marketplace integrations retrieved', 200, { integrations });
}));

/**
 * POST /api/integrations/install
 * Install integration from marketplace
 */
router.post('/install', auth, asyncHandler(async (req, res) => {
  const { marketplaceId, config, workspaceId = null } = req.body;

  if (!marketplaceId || !config) {
    return sendError(res, 'Marketplace ID and config are required', 400);
  }

  const integration = await installIntegration(req.user._id, marketplaceId, {
    ...config,
    workspaceId
  });

  sendSuccess(res, 'Integration installed', 201, integration);
}));

/**
 * GET /api/integrations
 * List user integrations
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { type = null, status = null, workspaceId = null } = req.query;

  const query = { userId: req.user._id };
  if (type) query.type = type;
  if (status) query.status = status;
  if (workspaceId) query.workspaceId = workspaceId;

  const integrations = await Integration.find(query).sort({ createdAt: -1 }).lean();
  sendSuccess(res, 'Integrations retrieved', 200, { integrations });
}));

/**
 * GET /api/integrations/:id
 * Get integration
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const integration = await Integration.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).lean();

  if (!integration) {
    return sendError(res, 'Integration not found', 404);
  }

  // Don't send sensitive credentials
  if (integration.config) {
    delete integration.config.apiSecret;
    if (integration.config.credentials) {
      delete integration.config.credentials.refreshToken;
    }
  }

  sendSuccess(res, 'Integration retrieved', 200, integration);
}));

/**
 * PUT /api/integrations/:id
 * Update integration
 */
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const integration = await Integration.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!integration) {
    return sendError(res, 'Integration not found', 404);
  }

  Object.assign(integration, req.body);
  await integration.save();

  const response = integration.toObject();
  if (response.config) {
    delete response.config.apiSecret;
  }

  sendSuccess(res, 'Integration updated', 200, response);
}));

/**
 * DELETE /api/integrations/:id
 * Delete integration
 */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const integration = await Integration.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!integration) {
    return sendError(res, 'Integration not found', 404);
  }

  await integration.deleteOne();
  sendSuccess(res, 'Integration deleted', 200, { id: req.params.id });
}));

/**
 * POST /api/integrations/:id/sync
 * Sync content to/from integration
 */
router.post('/:id/sync', auth, asyncHandler(async (req, res) => {
  const { content, direction = 'push' } = req.body;

  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const result = await syncContentToIntegration(req.params.id, content, direction);
  sendSuccess(res, 'Content synced', 200, result);
}));

/**
 * POST /api/integrations/:id/health
 * Check integration health
 */
router.post('/:id/health', auth, asyncHandler(async (req, res) => {
  const health = await checkIntegrationHealth(req.params.id);
  sendSuccess(res, 'Integration health checked', 200, health);
}));

/**
 * GET /api/integrations/marketplace/popular
 * Get popular integrations
 */
router.get('/marketplace/popular', auth, asyncHandler(async (req, res) => {
  const { getPopularIntegrations } = require('../services/integrationService');
  const limit = parseInt(req.query.limit) || 10;
  const integrations = await getPopularIntegrations(limit);
  sendSuccess(res, 'Popular integrations retrieved', 200, { integrations });
}));

/**
 * GET /api/integrations/marketplace/provider/:provider
 * Get integration by provider
 */
router.get('/marketplace/provider/:provider', auth, asyncHandler(async (req, res) => {
  const { getIntegrationByProvider } = require('../services/integrationService');
  const integration = await getIntegrationByProvider(req.params.provider);
  if (!integration) {
    return sendError(res, 'Integration not found', 404);
  }
  sendSuccess(res, 'Integration retrieved', 200, integration);
}));

/**
 * POST /api/integrations/:id/sync-all
 * Sync content to all active integrations
 */
router.post('/:id/sync-all', auth, asyncHandler(async (req, res) => {
  const { syncContentToAllIntegrations } = require('../services/integrationService');
  const { content, direction = 'push' } = req.body;
  
  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const results = await syncContentToAllIntegrations(req.user._id, content, direction);
  sendSuccess(res, 'Content synced to all integrations', 200, { results });
}));

/**
 * GET /api/integrations/:id/oauth/authorize
 * Generate OAuth authorization URL
 */
router.get('/:id/oauth/authorize', auth, asyncHandler(async (req, res) => {
  const { generateOAuthUrl } = require('../services/integrationOAuthService');
  const { redirectUri } = req.query;

  if (!redirectUri) {
    return sendError(res, 'Redirect URI is required', 400);
  }

  const result = await generateOAuthUrl(req.params.id, req.user._id, redirectUri);
  sendSuccess(res, 'OAuth URL generated', 200, result);
}));

/**
 * GET /api/integrations/:id/oauth/callback
 * Handle OAuth callback
 */
router.get('/:id/oauth/callback', auth, asyncHandler(async (req, res) => {
  const { handleOAuthCallback } = require('../services/integrationOAuthService');
  const { code, state } = req.query;

  if (!code || !state) {
    return sendError(res, 'Code and state are required', 400);
  }

  const result = await handleOAuthCallback(req.params.id, code, state);
  sendSuccess(res, 'OAuth callback handled', 200, result);
}));

/**
 * POST /api/integrations/:id/oauth/refresh
 * Refresh OAuth token
 */
router.post('/:id/oauth/refresh', auth, asyncHandler(async (req, res) => {
  const { refreshOAuthToken } = require('../services/integrationOAuthService');
  const result = await refreshOAuthToken(req.params.id);
  sendSuccess(res, 'OAuth token refreshed', 200, result);
}));

/**
 * POST /api/integrations/:id/test
 * Test integration connection
 */
router.post('/:id/test', auth, asyncHandler(async (req, res) => {
  const { testIntegration } = require('../services/integrationOAuthService');
  const result = await testIntegration(req.params.id, req.body.testData);
  sendSuccess(res, 'Integration tested', 200, result);
}));

/**
 * GET /api/integrations/marketplace/search
 * Search marketplace integrations
 */
router.get('/marketplace/search', auth, asyncHandler(async (req, res) => {
  const { getMarketplaceIntegrations } = require('../services/integrationService');
  const { q, category, features, verified } = req.query;

  let integrations = await getMarketplaceIntegrations(category, q);

  // Filter by features
  if (features) {
    const featureList = features.split(',');
    integrations = integrations.filter(integration => 
      featureList.every(feature => integration.features?.includes(feature))
    );
  }

  // Filter by verified
  if (verified === 'true') {
    integrations = integrations.filter(integration => integration.isVerified);
  }

  // Sort by popularity
  integrations.sort((a, b) => {
    const scoreA = (a.stats?.installs || 0) * 0.7 + (a.stats?.rating || 0) * 0.3;
    const scoreB = (b.stats?.installs || 0) * 0.7 + (b.stats?.rating || 0) * 0.3;
    return scoreB - scoreA;
  });

  sendSuccess(res, 'Marketplace search completed', 200, { integrations });
}));

/**
 * GET /api/integrations/analytics
 * Get integration analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const Integration = require('../models/Integration');
  const { startDate, endDate } = req.query;

  const query = { userId: req.user._id };
  const integrations = await Integration.find(query).lean();

  const analytics = {
    total: integrations.length,
    active: integrations.filter(i => i.status === 'active').length,
    byType: {},
    byStatus: {},
    health: {
      healthy: 0,
      degraded: 0,
      down: 0
    },
    syncStats: {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0
    }
  };

  integrations.forEach(integration => {
    // By type
    if (!analytics.byType[integration.type]) {
      analytics.byType[integration.type] = 0;
    }
    analytics.byType[integration.type]++;

    // By status
    if (!analytics.byStatus[integration.status]) {
      analytics.byStatus[integration.status] = 0;
    }
    analytics.byStatus[integration.status]++;

    // Health
    if (integration.health?.status) {
      analytics.health[integration.health.status]++;
    }

    // Sync stats (would be calculated from sync logs in production)
    if (integration.sync?.enabled) {
      analytics.syncStats.totalSyncs++;
      if (integration.status === 'active') {
        analytics.syncStats.successfulSyncs++;
      } else {
        analytics.syncStats.failedSyncs++;
      }
    }
  });

  sendSuccess(res, 'Integration analytics retrieved', 200, analytics);
}));

module.exports = router;

