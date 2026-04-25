// Rate Limiter for OAuth Endpoints

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter for OAuth authorization requests
 * Prevents abuse of OAuth flow
 */
const oauthAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many OAuth authorization requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('OAuth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?._id,
    });
    res.status(429).json({
      success: false,
      error: 'Too many OAuth authorization requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter for OAuth token exchange
 * More restrictive to prevent token abuse
 */
const oauthTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 token exchanges per hour
  message: {
    success: false,
    error: 'Too many token exchange requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('OAuth token rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?._id,
    });
    res.status(429).json({
      success: false,
      error: 'Too many token exchange requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter for OAuth posting operations
 */
const oauthPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 posts per 15 minutes
  message: {
    success: false,
    error: 'Too many posting requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('OAuth post rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?._id,
    });
    res.status(429).json({
      success: false,
      error: 'Too many posting requests. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

module.exports = {
  oauthAuthLimiter,
  oauthTokenLimiter,
  oauthPostLimiter,
};




