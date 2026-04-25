// Usage Tracking Middleware
// Automatically track usage for billing and limits

const { incrementUsage, canPerformAction } = require('../services/usageTrackingService');
const logger = require('../utils/logger');

/**
 * Middleware to track usage for specific actions
 */
const trackUsage = (usageType, amount = 1) => {
  return async (req, res, next) => {
    // Track usage asynchronously (don't block request)
    if (req.user && req.user._id) {
      incrementUsage(req.user._id, usageType, amount).catch(err => {
        logger.warn('Failed to track usage', { error: err.message, userId: req.user._id, usageType });
      });
    }
    next();
  };
};

/**
 * Middleware to check usage limits before action
 */
const checkUsageLimit = (usageType, amount = 1) => {
  return async (req, res, next) => {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      const check = await canPerformAction(req.user._id, usageType, amount);

      if (!check.allowed) {
        return res.status(403).json({
          success: false,
          error: `Usage limit exceeded for ${usageType}`,
          limit: check.limit,
          current: check.current,
          remaining: check.remaining,
          overage: check.overage,
          upgradeRequired: true
        });
      }

      req.usageCheck = check;
      next();
    } catch (error) {
      logger.error('Error checking usage limit', { error: error.message, userId: req.user._id });
      return res.status(500).json({
        success: false,
        error: 'Error checking usage limits'
      });
    }
  };
};

module.exports = {
  trackUsage,
  checkUsageLimit
};


