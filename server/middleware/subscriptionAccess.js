// Subscription access control middleware

const { hasSubscriptionAccess, getSubscriptionStatus } = require('../services/subscriptionService');
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Check if user has active subscription
 */
const requireActiveSubscription = (req, res, next) => {
  // Developer convenience: allow bypassing subscription checks in non-production.
  // This is critical for local testing (video upload/editing) when subscription billing isn't configured.
  if (process.env.NODE_ENV !== 'production' && process.env.BYPASS_SUBSCRIPTION === 'true') {
    return next();
  }
  // If the request is coming from a local dev environment, allow bypass even without env vars.
  // This unblocks localhost testing while keeping production protected.
  if (process.env.NODE_ENV !== 'production') {
    const hostHeader = (req.headers.host || '').toLowerCase();
    if (hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1')) {
      return next();
    }
  }

  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  const hasAccess = hasSubscriptionAccess(req.user);

  if (!hasAccess) {
    const status = getSubscriptionStatus(req.user);
    
    logger.warn('Subscription access denied', {
      userId: req.user._id,
      status: status.status,
      isExpired: status.isExpired
    });

    return res.status(403).json({
      success: false,
      error: 'Subscription required',
      subscriptionStatus: status,
      message: status.isExpired
        ? 'Your subscription has expired. Please renew to continue using this feature.'
        : 'An active subscription is required to access this feature.'
    });
  }

  next();
};

/**
 * Check subscription for premium features
 */
const requirePremiumSubscription = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  const hasAccess = hasSubscriptionAccess(req.user);
  const status = getSubscriptionStatus(req.user);

  // Check if user has premium package (not free)
  const isFree = req.user.membershipPackage && 
                 req.user.membershipPackage.slug === 'free';

  if (!hasAccess || isFree) {
    logger.warn('Premium subscription required', {
      userId: req.user._id,
      status: status.status,
      isFree
    });

    return res.status(403).json({
      success: false,
      error: 'Premium subscription required',
      subscriptionStatus: status,
      message: 'This feature requires a premium subscription. Please upgrade your plan.'
    });
  }

  next();
};

/**
 * Allow access but show warning for expiring subscriptions
 */
const checkSubscriptionStatus = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const status = getSubscriptionStatus(req.user);
  
  // Add subscription status to response headers
  res.setHeader('X-Subscription-Status', status.status);
  res.setHeader('X-Subscription-Expiring', status.isExpiringSoon ? 'true' : 'false');
  res.setHeader('X-Subscription-Days-Left', status.daysUntilExpiry.toString());

  // Add to request for use in route handlers
  req.subscriptionStatus = status;

  next();
};

module.exports = {
  requireActiveSubscription,
  requirePremiumSubscription,
  checkSubscriptionStatus
};







