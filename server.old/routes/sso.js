// SSO Routes

const express = require('express');
const {
  generateSAMLRequest,
  processSAMLResponse,
  authenticateGoogle,
  authenticateMicrosoft,
  SSO_PROVIDERS,
} = require('../services/ssoService');
const SSOProvider = require('../models/SSOProvider');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/sso/providers:
 *   get:
 *     summary: Get available SSO providers
 *     tags: [SSO]
 */
router.get('/providers', asyncHandler(async (req, res) => {
  try {
    const providers = await SSOProvider.find({ enabled: true })
      .select('name type')
      .lean();

    sendSuccess(res, 'SSO providers fetched', 200, providers);
  } catch (error) {
    logger.error('Get SSO providers error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/sso/saml/initiate:
 *   post:
 *     summary: Initiate SAML SSO
 *     tags: [SSO]
 */
router.post('/saml/initiate', asyncHandler(async (req, res) => {
  const { providerId, relayState } = req.body;

  try {
    const provider = await SSOProvider.findOne({
      _id: providerId,
      type: 'saml',
      enabled: true,
    });

    if (!provider) {
      return sendError(res, 'SSO provider not found', 404);
    }

    const samlRequest = generateSAMLRequest(provider, relayState);
    sendSuccess(res, 'SAML request generated', 200, samlRequest);
  } catch (error) {
    logger.error('Initiate SAML error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/sso/saml/callback:
 *   post:
 *     summary: Handle SAML callback
 *     tags: [SSO]
 */
router.post('/saml/callback', asyncHandler(async (req, res) => {
  const { SAMLResponse, RelayState, providerId } = req.body;

  if (!SAMLResponse) {
    return sendError(res, 'SAMLResponse is required', 400);
  }

  try {
    const provider = await SSOProvider.findOne({
      _id: providerId,
      type: 'saml',
      enabled: true,
    });

    if (!provider) {
      return sendError(res, 'SSO provider not found', 404);
    }

    const result = await processSAMLResponse(SAMLResponse, provider);

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${result.token}&relayState=${RelayState || ''}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('SAML callback error', { error: error.message });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * @swagger
 * /api/sso/google:
 *   get:
 *     summary: Initiate Google OAuth
 *     tags: [SSO]
 */
router.get('/google', asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:5001'}/api/sso/google/callback`;
  const scope = 'openid email profile';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  res.redirect(authUrl);
}));

/**
 * @swagger
 * /api/sso/google/callback:
 *   get:
 *     summary: Handle Google OAuth callback
 *     tags: [SSO]
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=no_code`);
  }

  try {
    const result = await authenticateGoogle(code);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${result.token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Google callback error', { error: error.message });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * @swagger
 * /api/sso/microsoft:
 *   get:
 *     summary: Initiate Microsoft OAuth
 *     tags: [SSO]
 */
router.get('/microsoft', asyncHandler(async (req, res) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:5001'}/api/sso/microsoft/callback`;
  const scope = 'openid email profile';

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  res.redirect(authUrl);
}));

/**
 * @swagger
 * /api/sso/microsoft/callback:
 *   get:
 *     summary: Handle Microsoft OAuth callback
 *     tags: [SSO]
 */
router.get('/microsoft/callback', asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=no_code`);
  }

  try {
    const result = await authenticateMicrosoft(code);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${result.token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Microsoft callback error', { error: error.message });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
}));

module.exports = router;






