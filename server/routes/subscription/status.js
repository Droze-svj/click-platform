// Subscription status routes

const express = require('express');
const User = require('../../models/User');
const auth = require('../../middleware/auth');
const { getSubscriptionStatus, isSubscriptionExpiringSoon, getDaysUntilExpiry } = require('../../services/subscriptionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
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
  const user = await User.findById(req.user._id).populate('membershipPackage');
  
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







