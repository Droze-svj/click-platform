// SSO (Single Sign-On) Service

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Supported SSO providers
const SSO_PROVIDERS = {
  SAML: 'saml',
  OIDC: 'oidc',
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
  OKTA: 'okta',
};

/**
 * Generate SAML request
 */
function generateSAMLRequest(provider, relayState = null) {
  try {
    const samlRequest = {
      id: crypto.randomBytes(16).toString('hex'),
      issuer: process.env.SAML_ISSUER || 'click',
      destination: provider.ssoUrl,
      relayState: relayState || crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
    };

    // Sign SAML request (simplified - in production use proper SAML library)
    const signedRequest = signSAMLRequest(samlRequest, provider.certificate);

    return {
      samlRequest: signedRequest,
      relayState: samlRequest.relayState,
      ssoUrl: provider.ssoUrl,
    };
  } catch (error) {
    logger.error('Generate SAML request error', { error: error.message });
    throw error;
  }
}

/**
 * Process SAML response
 */
async function processSAMLResponse(samlResponse, provider) {
  try {
    // Verify SAML response signature
    const verified = verifySAMLResponse(samlResponse, provider.certificate);
    if (!verified) {
      throw new Error('Invalid SAML response signature');
    }

    // Extract user attributes
    const attributes = extractSAMLAttributes(samlResponse);

    // Find or create user
    const user = await findOrCreateSSOUser(attributes, provider.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('SAML authentication successful', { userId: user._id });
    return {
      user,
      token,
    };
  } catch (error) {
    logger.error('Process SAML response error', { error: error.message });
    throw error;
  }
}

/**
 * OIDC authentication
 */
async function authenticateOIDC(code, provider) {
  try {
    // Exchange code for token
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uri: provider.redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json();

    // Find or create user
    const user = await findOrCreateSSOUser(userInfo, provider.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('OIDC authentication successful', { userId: user._id });
    return {
      user,
      token,
    };
  } catch (error) {
    logger.error('OIDC authentication error', { error: error.message });
    throw error;
  }
}

/**
 * Google OAuth authentication
 */
async function authenticateGoogle(code) {
  try {
    const provider = {
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      id: 'google',
    };

    return await authenticateOIDC(code, provider);
  } catch (error) {
    logger.error('Google authentication error', { error: error.message });
    throw error;
  }
}

/**
 * Microsoft OAuth authentication
 */
async function authenticateMicrosoft(code) {
  try {
    const provider = {
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      id: 'microsoft',
    };

    return await authenticateOIDC(code, provider);
  } catch (error) {
    logger.error('Microsoft authentication error', { error: error.message });
    throw error;
  }
}

/**
 * Find or create user from SSO
 */
async function findOrCreateSSOUser(attributes, providerId) {
  try {
    const email = attributes.email || attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
    const name = attributes.name || attributes.displayName || attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];

    if (!email) {
      throw new Error('Email not found in SSO attributes');
    }

    // Find existing user
    let user = await User.findOne({ email });

    if (user) {
      // Update SSO provider info
      if (!user.ssoProviders) {
        user.ssoProviders = [];
      }
      if (!user.ssoProviders.includes(providerId)) {
        user.ssoProviders.push(providerId);
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        name: name || email.split('@')[0],
        ssoProviders: [providerId],
        ssoId: attributes.id || attributes.sub || email,
        emailVerified: true, // SSO emails are verified
        lastLogin: new Date(),
      });
      await user.save();
    }

    return user;
  } catch (error) {
    logger.error('Find or create SSO user error', { error: error.message });
    throw error;
  }
}

/**
 * Sign SAML request (simplified)
 */
function signSAMLRequest(request, certificate) {
  // In production, use proper SAML library (e.g., saml2-js)
  // This is a simplified version
  return Buffer.from(JSON.stringify(request)).toString('base64');
}

/**
 * Verify SAML response (simplified)
 */
function verifySAMLResponse(response, certificate) {
  // In production, use proper SAML library
  // This is a simplified version
  try {
    const decoded = JSON.parse(Buffer.from(response, 'base64').toString());
    return decoded && decoded.attributes;
  } catch (error) {
    return false;
  }
}

/**
 * Extract SAML attributes
 */
function extractSAMLAttributes(samlResponse) {
  try {
    const decoded = JSON.parse(Buffer.from(samlResponse, 'base64').toString());
    return decoded.attributes || {};
  } catch (error) {
    logger.error('Extract SAML attributes error', { error: error.message });
    return {};
  }
}

module.exports = {
  generateSAMLRequest,
  processSAMLResponse,
  authenticateOIDC,
  authenticateGoogle,
  authenticateMicrosoft,
  SSO_PROVIDERS,
};






