// CSRF Protection Middleware

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF token storage (in production, use Redis or session store)
 */
const tokenStore = new Map();

/**
 * CSRF protection middleware
 * Note: For JWT-based APIs, CSRF is less critical but still useful for web forms
 */
function csrfProtection(req, res, next) {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for local debug relay endpoints (dev only)
  // Mounted under /api, so req.path here will be like "/debug/log"
  if (process.env.NODE_ENV !== 'production' && req.path.startsWith('/debug')) {
    return next();
  }

  // Skip CSRF for authentication endpoints (they use JWT, not sessions)
  // req.path will be like "/auth/forgot-password" when mounted under "/api/auth"
  if (req.path.startsWith('/auth/login') ||
      req.path.startsWith('/auth/register') ||
      req.path.startsWith('/auth/logout') ||
      req.path.startsWith('/auth/refresh') ||
      req.path.startsWith('/auth/forgot-password') ||
      req.path.startsWith('/auth/reset-password') ||
      req.path.startsWith('/auth/validate-reset-token') ||
      req.path.startsWith('/auth/verify-email') ||
      req.path.startsWith('/auth/resend-verification') ||
      req.path.startsWith('/auth/profile') ||
      req.path.startsWith('/auth/change-password')) {
    console.log('Skipping CSRF for auth endpoint:', req.path);
    return next();
  }

  // Skip if JWT token is present (JWT auth doesn't need CSRF protection)
  const authToken = req.header('Authorization')?.replace('Bearer ', '');
  if (authToken) {
    // JWT-based authentication - CSRF not needed
    return next();
  }

  // For session-based requests, require CSRF token
  // Safely access req.body (may not be parsed yet)
  const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);

  // Get session token (in production, get from session store)
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  const sessionToken = tokenStore.get(sessionId);

  if (!token || !sessionToken) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing or invalid',
    });
  }

  // Verify token
  if (token !== sessionToken) {
    logger.warn('CSRF token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF token mismatch',
    });
  }

  next();
}

/**
 * Generate and store CSRF token for session
 */
function generateAndStoreToken(sessionId) {
  const token = generateCSRFToken();
  tokenStore.set(sessionId, token);
  
  // Clean up old tokens (in production, use TTL)
  setTimeout(() => {
    tokenStore.delete(sessionId);
  }, 24 * 60 * 60 * 1000); // 24 hours

  return token;
}

/**
 * Get CSRF token for session
 */
function getCSRFToken(sessionId) {
  let token = tokenStore.get(sessionId);
  if (!token) {
    token = generateAndStoreToken(sessionId);
  }
  return token;
}

module.exports = {
  csrfProtection,
  generateAndStoreToken,
  getCSRFToken,
};


