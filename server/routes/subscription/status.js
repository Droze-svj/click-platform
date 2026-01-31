// Subscription status routes

const express = require('express');
const User = require('../../models/User');
const auth = require('../../middleware/auth');
const { getSubscriptionStatus, isSubscriptionExpiringSoon, getDaysUntilExpiry } = require('../../services/subscriptionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/subscription/status:
 *   get:
 *     summary: Get subscription status
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  // Check both host header and x-forwarded-host (for proxy requests)
  const host = req.headers.host || req.headers['x-forwarded-host'] || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
  const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
  
  // In development mode OR when on localhost with dev users, return mock subscription data
  const userId = req.user?._id || req.user?.id;
  if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
    const mockStatus = {
      isActive: true,
      isExpiringSoon: false,
      daysUntilExpiry: 30,
      status: 'active',
      plan: 'monthly'
    };
    
    return sendSuccess(res, 'Subscription status fetched', 200, {
      ...mockStatus,
      package: {
        name: 'Development Plan',
        slug: 'dev-plan',
        features: ['all_features']
      },
      subscription: {
        status: 'active',
        plan: 'monthly',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });
  }

  // For production or non-dev users, try to fetch from database
  // But wrap in try-catch to handle MongoDB connection errors gracefully
  let user;
  try {
    user = await User.findById(req.user._id || req.user.id).populate('membershipPackage');
  } catch (dbError) {
    // Handle CastError gracefully for dev mode
    if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId'))) {
      logger.warn('CastError in subscription status, returning mock data for dev mode', { error: dbError.message, userId });
      return sendSuccess(res, 'Subscription status fetched', 200, {
        isActive: true,
        isExpiringSoon: false,
        daysUntilExpiry: 30,
        status: 'active',
        plan: 'monthly',
        package: {
          name: 'Development Plan',
          slug: 'dev-plan',
          features: ['all_features']
        },
        subscription: {
          status: 'active',
          plan: 'monthly',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
    logger.error('Database error in subscription status', { error: dbError.message, userId });
    // If database is not available, return error
    return sendError(res, 'Database unavailable', 503);
  }
  
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const status = getSubscriptionStatus(user);
  const packageInfo = user.membershipPackage ? {
    name: user.membershipPackage.name,
    slug: user.membershipPackage.slug,
    features: user.membershipPackage.features
  } : null;

  sendSuccess(res, 'Subscription status fetched', 200, {
    ...status,
    package: packageInfo,
    subscription: user.subscription
  });
}));

/**
 * @swagger
 * /api/subscription/renewal-reminder:
 *   post:
 *     summary: Set renewal reminder preference
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post('/renewal-reminder', auth, asyncHandler(async (req, res) => {
  const { enabled = true, daysBefore = [7, 3, 1] } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Store reminder preferences (you might want to add this to user model)
  user.renewalReminderEnabled = enabled;
  user.renewalReminderDays = daysBefore;
  await user.save();

  sendSuccess(res, 'Renewal reminder preferences updated', 200);
}));

module.exports = router;







