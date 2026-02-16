// Subscription management service

const User = require('../models/User');
const { isDevUser } = require('../utils/devUser');
const MembershipPackage = require('../models/MembershipPackage');
const Notification = require('../models/Notification');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check if subscription is expired
 */
function isSubscriptionExpired(user) {
  if (!user.subscription || !user.subscription.endDate) {
    return true;
  }

  const endDate = new Date(user.subscription.endDate);
  const now = new Date();
  return endDate < now;
}

/**
 * Check if subscription is expiring soon
 */
function isSubscriptionExpiringSoon(user, daysBefore = 7) {
  if (!user.subscription || !user.subscription.endDate) {
    return false;
  }

  const endDate = new Date(user.subscription.endDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  return daysUntilExpiry > 0 && daysUntilExpiry <= daysBefore;
}

/**
 * Get days until subscription expires
 */
function getDaysUntilExpiry(user) {
  if (!user.subscription || !user.subscription.endDate) {
    return 0;
  }

  const endDate = new Date(user.subscription.endDate);
  const now = new Date();
  const days = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

/**
 * Handle subscription expiration
 */
async function handleSubscriptionExpiration(user) {
  try {
    // Update subscription status
    user.subscription.status = 'expired';
    await user.save();

    // Downgrade to free package
    const freePackage = await MembershipPackage.findOne({ isDefault: true });
    if (freePackage) {
      user.membershipPackage = freePackage._id;
      await user.save();
    }

    // Send notification
    await notificationService.notifyUser(user._id, {
      type: 'warning',
      title: 'Subscription Expired',
      message: 'Your subscription has expired. You have been downgraded to the free plan.',
      data: { subscriptionStatus: 'expired' }
    });

    // Save notification to database
    await Notification.create({
      userId: user._id,
      type: 'warning',
      title: 'Subscription Expired',
      message: 'Your subscription has expired. You have been downgraded to the free plan.'
    });

    logger.info('Subscription expired handled', { userId: user._id });
  } catch (error) {
    logger.error('Error handling subscription expiration', { error: error.message, userId: user._id });
  }
}

/**
 * Send expiration warning notifications
 */
async function sendExpirationWarnings(daysBefore = [7, 3, 1]) {
  try {
    const now = new Date();
    const users = await User.find({
      'subscription.status': 'active',
      'subscription.endDate': { $exists: true }
    }).populate('membershipPackage');

    for (const user of users) {
      const daysUntilExpiry = getDaysUntilExpiry(user);

      if (daysBefore.includes(daysUntilExpiry)) {
        // Check if notification already sent for this day
        const existingNotification = await Notification.findOne({
          userId: user._id,
          'data.daysUntilExpiry': daysUntilExpiry,
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        });

        if (!existingNotification) {
          await notificationService.notifyUser(user._id, {
            type: 'warning',
            title: 'Subscription Expiring Soon',
            message: `Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}. Renew now to continue enjoying all features.`,
            data: { daysUntilExpiry, subscriptionEndDate: user.subscription.endDate }
          });

          await Notification.create({
            userId: user._id,
            type: 'warning',
            title: 'Subscription Expiring Soon',
            message: `Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}. Renew now to continue enjoying all features.`,
            data: { daysUntilExpiry, subscriptionEndDate: user.subscription.endDate }
          });

          logger.info('Expiration warning sent', { userId: user._id, daysUntilExpiry });
        }
      }
    }
  } catch (error) {
    logger.error('Error sending expiration warnings', { error: error.message });
  }
}

/**
 * Process expired subscriptions
 */
async function processExpiredSubscriptions() {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      'subscription.status': 'active',
      'subscription.endDate': { $lt: now }
    });

    logger.info(`Processing ${expiredUsers.length} expired subscriptions`);

    for (const user of expiredUsers) {
      await handleSubscriptionExpiration(user);
    }

    logger.info('Expired subscriptions processed', { count: expiredUsers.length });
  } catch (error) {
    logger.error('Error processing expired subscriptions', { error: error.message });
  }
}

/**
 * Check subscription access
 */
function hasSubscriptionAccess(user) {
  if (process.env.NODE_ENV !== 'production' && isDevUser(user)) {
    return true;
  }

  // Admin always has access
  if (user.role === 'admin') {
    return true;
  }

  // Check subscription status
  if (user.subscription && user.subscription.status === 'active') {
    // Check if expired
    if (isSubscriptionExpired(user)) {
      return false;
    }
    return true;
  }

  // Trial users have limited access
  if (user.subscription && user.subscription.status === 'trial') {
    if (isSubscriptionExpired(user)) {
      return false;
    }
    return true;
  }

  // Expired or cancelled - no access (except free tier)
  if (user.subscription && (user.subscription.status === 'expired' || user.subscription.status === 'cancelled')) {
    // Free package users can still access basic features
    return user.membershipPackage && user.membershipPackage.slug === 'free';
  }

  return false;
}

/**
 * Get subscription status info
 */
function getSubscriptionStatus(user) {
  const isExpired = isSubscriptionExpired(user);
  const isExpiringSoon = isSubscriptionExpiringSoon(user);
  const daysUntilExpiry = getDaysUntilExpiry(user);
  const hasAccess = hasSubscriptionAccess(user);

  // Handle users without subscription (dev users, new users, etc.)
  if (!user.subscription) {
    return {
      status: 'none',
      isExpired: true,
      isExpiringSoon: false,
      daysUntilExpiry: 0,
      hasAccess,
      endDate: null,
      startDate: null,
      plan: null
    };
  }

  return {
    status: user.subscription.status || 'none',
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
    hasAccess,
    endDate: user.subscription.endDate || null,
    startDate: user.subscription.startDate || null,
    plan: user.subscription.plan || null
  };
}

/**
 * Extend trial period (for testing or special cases)
 */
async function extendTrial(userId, additionalDays = 7) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.subscription.status !== 'trial') {
      throw new Error('User is not on trial');
    }

    const currentEndDate = new Date(user.subscription.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + additionalDays);
    user.subscription.endDate = currentEndDate;

    await user.save();

    await notificationService.notifyUser(userId, {
      type: 'success',
      title: 'Trial Extended',
      message: `Your trial has been extended by ${additionalDays} days.`,
      data: { additionalDays }
    });

    logger.info('Trial extended', { userId, additionalDays });
    return user;
  } catch (error) {
    logger.error('Error extending trial', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isSubscriptionExpired,
  isSubscriptionExpiringSoon,
  getDaysUntilExpiry,
  handleSubscriptionExpiration,
  sendExpirationWarnings,
  processExpiredSubscriptions,
  hasSubscriptionAccess,
  getSubscriptionStatus,
  extendTrial
};







