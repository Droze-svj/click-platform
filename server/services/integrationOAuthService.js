// Integration OAuth Service
// Generic OAuth flow helpers for marketplace integrations: URL generation, callback handling, token refresh, connection testing.

const Integration = require('../models/Integration');
const IntegrationMarketplace = require('../models/IntegrationMarketplace');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const LOG_CONTEXT = { service: 'integration-oauth' };

async function generateOAuthUrl(integrationId, userId, redirectUri) {
  const integration = await Integration.findById(integrationId);
  if (!integration || integration.userId.toString() !== userId.toString()) {
    throw new Error('Integration not found or unauthorized');
  }

  const marketplace = await IntegrationMarketplace.findById(integration.metadata?.marketplaceId);
  if (!marketplace || marketplace.authType !== 'oauth') {
    throw new Error('Integration does not support OAuth');
  }

  const state = crypto.randomBytes(32).toString('hex');
  integration.config.oauthState = state;
  integration.config.oauthRedirectUri = redirectUri;
  await integration.save();

  const params = new URLSearchParams({
    client_id: integration.config.credentials?.clientId || integration.config.apiKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: marketplace.api?.scopes?.join(' ') || 'read write',
    state,
  });

  const authUrl = `${marketplace.api?.authUrl || marketplace.api?.baseUrl}/oauth/authorize?${params.toString()}`;
  logger.info('OAuth URL generated', { ...LOG_CONTEXT, integrationId, userId });
  return { authUrl, state };
}

async function handleOAuthCallback(integrationId, code, state) {
  const integration = await Integration.findById(integrationId);
  if (!integration) throw new Error('Integration not found');
  if (integration.config.oauthState !== state) throw new Error('Invalid OAuth state');

  const marketplace = await IntegrationMarketplace.findById(integration.metadata?.marketplaceId);
  if (!marketplace) throw new Error('Marketplace integration not found');

  const tokenUrl = marketplace.api?.tokenUrl || `${marketplace.api?.baseUrl}/oauth/token`;
  const tokenRes = await axios.post(
    tokenUrl,
    {
      client_id: integration.config.credentials?.clientId || integration.config.apiKey,
      client_secret: integration.config.credentials?.clientSecret || integration.config.apiSecret,
      code,
      redirect_uri: integration.config.oauthRedirectUri,
      grant_type: 'authorization_code',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  integration.config.credentials = {
    ...integration.config.credentials,
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
  };

  delete integration.config.oauthState;
  delete integration.config.oauthRedirectUri;
  integration.status = 'active';
  await integration.save();

  logger.info('OAuth callback handled', { ...LOG_CONTEXT, integrationId });
  return { success: true, integration };
}

async function refreshOAuthToken(integrationId) {
  const integration = await Integration.findById(integrationId);
  if (!integration) throw new Error('Integration not found');

  const marketplace = await IntegrationMarketplace.findById(integration.metadata?.marketplaceId);
  if (!marketplace) throw new Error('Marketplace integration not found');

  const refreshToken = integration.config.credentials?.refreshToken;
  if (!refreshToken) throw new Error('No refresh token available');

  const tokenUrl = marketplace.api?.tokenUrl || `${marketplace.api?.baseUrl}/oauth/token`;
  const tokenRes = await axios.post(
    tokenUrl,
    {
      client_id: integration.config.credentials?.clientId || integration.config.apiKey,
      client_secret: integration.config.credentials?.clientSecret || integration.config.apiSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const { access_token, refresh_token: newRefreshToken, expires_in } = tokenRes.data;
  integration.config.credentials = {
    ...integration.config.credentials,
    accessToken: access_token,
    refreshToken: newRefreshToken || refreshToken,
    expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
  };

  await integration.save();
  logger.info('OAuth token refreshed', { ...LOG_CONTEXT, integrationId });
  return { success: true, expiresAt: integration.config.credentials.expiresAt };
}

async function testIntegration(integrationId, testData = {}) {
  const integration = await Integration.findById(integrationId);
  if (!integration) throw new Error('Integration not found');

  const marketplace = await IntegrationMarketplace.findById(integration.metadata?.marketplaceId);
  if (!marketplace) throw new Error('Marketplace integration not found');

  if (integration.config.credentials?.expiresAt && integration.config.credentials.expiresAt < new Date()) {
    await refreshOAuthToken(integrationId);
    await integration.populate();
  }

  const testEndpoint = marketplace.api?.endpoints?.test || '/api/test';
  const url = `${integration.config.baseUrl}${testEndpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  switch (marketplace.authType) {
    case 'oauth':
      if (integration.config.credentials?.accessToken) {
        headers.Authorization = `Bearer ${integration.config.credentials.accessToken}`;
      }
      break;
    case 'api_key':
      if (integration.config.apiKey) headers['X-API-Key'] = integration.config.apiKey;
      break;
    case 'bearer':
      if (integration.config.apiKey) headers.Authorization = `Bearer ${integration.config.apiKey}`;
      break;
    case 'basic':
      if (integration.config.apiKey && integration.config.apiSecret) {
        const credentials = Buffer.from(`${integration.config.apiKey}:${integration.config.apiSecret}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
      }
      break;
  }

  const startTime = Date.now();
  const response = await axios.post(url, testData, {
    headers,
    timeout: 10000,
    validateStatus: () => true,
  });
  const responseTime = Date.now() - startTime;

  const success = response.status >= 200 && response.status < 300;
  integration.health = {
    lastCheck: new Date(),
    status: success ? 'healthy' : 'degraded',
    responseTime,
    errorMessage: success ? null : `HTTP ${response.status}`,
  };

  if (!success) {
    integration.status = 'error';
  } else if (integration.status === 'error') {
    integration.status = 'active';
  }

  await integration.save();
  logger.info('Integration tested', { ...LOG_CONTEXT, integrationId, success, responseTime });

  return {
    success,
    statusCode: response.status,
    responseTime,
    response: response.data,
    health: integration.health,
  };
}

module.exports = {
  generateOAuthUrl,
  handleOAuthCallback,
  refreshOAuthToken,
  testIntegration,
};
