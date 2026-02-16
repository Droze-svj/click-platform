// Subscription access control middleware

const { hasSubscriptionAccess, getSubscriptionStatus } = require('../services/subscriptionService');
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Check if user has active subscription
 */
const requireActiveSubscription = (req, res, next) => {
  try {
    // Developer convenience: allow bypassing subscription checks in non-production.
    // This is critical for local testing (video upload/editing) when subscription billing isn't configured.
    const nodeEnv = process.env.NODE_ENV;
    const host = (req.headers.host || req.headers['x-forwarded-host'] || '').toLowerCase();
    const referer = (req.headers.referer || req.headers.origin || '').toLowerCase();
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      referer.includes('localhost') || referer.includes('127.0.0.1') ||
      (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));

    // Enhanced logging for debugging
    if (isLocalhost || !nodeEnv || nodeEnv !== 'production') {
      console.log('🔧 [Subscription] Middleware check', {
        nodeEnv: nodeEnv || 'undefined',
        isLocalhost,
        hasUser: !!req.user,
        userId: req.user?._id || req.user?.id,
        host,
        referer
      });
    }

    if (!nodeEnv || nodeEnv !== 'production') {
      // If BYPASS_SUBSCRIPTION is explicitly set, always allow
      if (process.env.BYPASS_SUBSCRIPTION === 'true') {
        return next();
      }

      // Allow localhost requests in non-production
      if (isLocalhost) {
        return next();
      }

      if (req.user?.isDevUser) {
        return next();
      }
    }

    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    // Check subscription access
    try {
      const hasAccess = hasSubscriptionAccess(req.user);

      if (!hasAccess) {
        const status = getSubscriptionStatus(req.user);

        logger.warn('Subscription access denied', {
          userId: req.user._id || req.user.id,
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
    } catch (error) {
      console.error('❌ [Subscription] Error checking subscription access', {
        error: error.message,
        errorName: error.name,
        stack: error.stack?.substring(0, 500),
        userId: req.user?._id || req.user?.id,
        nodeEnv: nodeEnv || 'undefined',
        isLocalhost
      });

      logger.error('Error checking subscription access', {
        error: error.message,
        userId: req.user?._id || req.user?.id,
        stack: error.stack
      });

      // In development or localhost, allow access on error to prevent blocking development
      if (!nodeEnv || nodeEnv !== 'production' || isLocalhost) {
        console.log('🔧 [Subscription] Allowing access in dev/localhost mode due to subscription check error');
        logger.warn('Allowing access in development mode due to subscription check error');
        return next();
      }

      return res.status(500).json({
        success: false,
        error: 'Error checking subscription access',
        message: error.message
      });
    }
  } catch (outerError) {
    // Catch any errors in the outer try block (like accessing req.user properties)
    console.error('❌ [Subscription] Outer error in middleware', {
      error: outerError.message,
      errorName: outerError.name,
      stack: outerError.stack?.substring(0, 500)
    });

    // In development, allow access to prevent blocking
    const nodeEnv = process.env.NODE_ENV;
    const host = (req.headers.host || req.headers['x-forwarded-host'] || '').toLowerCase();
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    if (!nodeEnv || nodeEnv !== 'production' || isLocalhost) {
      console.log('🔧 [Subscription] Allowing access due to outer error in dev/localhost mode');
      return next();
    }

    return res.status(500).json({
      success: false,
      error: 'Subscription middleware error',
      message: outerError.message
    });
  }
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







