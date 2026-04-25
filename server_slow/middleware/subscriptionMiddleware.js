const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Middleware to gate features based on Whop subscription status.
 * Requires the 'auth' middleware to have run first (so req.user is populated).
 * 
 * @param {string[]} allowedTiers - Array of tiers that can access the resource (e.g. ['pro', 'elite'])
 * @param {Object} options - Additional options
 * @param {boolean} options.allowTrial - Whether to allow users in a trial period (default: true)
 */
const requireSubscription = (allowedTiers = ['pro', 'elite', 'team'], options = {}) => {
  return (req, res, next) => {
    const { allowTrial = true } = options;

    // 1. Bypass check in non-production environments for local dev convenience
    const host = req.headers.host || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    if (process.env.NODE_ENV !== 'production' && isLocal && process.env.BYPASS_SUBSCRIPTION === 'true') {
      logger.debug('Bypassing subscription check in development mode');
      return next();
    }

    // 2. Ensure user is authenticated
    if (!req.user) {
      logger.error('Subscription check failed: User not authenticated');
      return sendError(res, 'Authentication required for subscription check', 401);
    }

    const { subscription } = req.user;

    // 3. Handle specific Elite/Internal access
    if (req.user.role === 'admin' || req.user.role === 'super') {
      return next();
    }

    // 4. Check status
    if (!subscription || subscription.status !== 'active') {
      // Check for trial
      if (allowTrial && req.user.trialEndsAt && new Date() < new Date(req.user.trialEndsAt)) {
        return next();
      }

      logger.warn('Access denied: Active subscription required', { 
        userId: req.user._id, 
        currentStatus: subscription?.status || 'none' 
      });

      return sendError(res, 'Active subscription required. Upgrade at whop.com/sovereign', 403, {
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: process.env.WHOP_STORE_URL || 'https://whop.com/sovereign'
      });
    }

    // 5. Check Tier (if specific tiers are required)
    const userTier = (subscription.plan || 'free').toLowerCase();
    const hasAccess = allowedTiers.some(tier => userTier.includes(tier));

    if (!hasAccess) {
      logger.warn('Access denied: Higher tier required', { 
        userId: req.user._id, 
        required: allowedTiers, 
        actual: userTier 
      });

      return sendError(res, `This feature requires a ${allowedTiers[0].toUpperCase()} plan.`, 403, {
        code: 'UPGRADE_REQUIRED',
        requiredTier: allowedTiers[0]
      });
    }

    next();
  };
};

module.exports = { requireSubscription };
