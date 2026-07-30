// Subscription management service

const User = require('../models/User');
const { isDevUser } = require('../utils/devUser');
const MembershipPackage = require('../models/MembershipPackage');
const Notification = require('../models/Notification');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Batch size for the _id-cursor cron scans below — keeps a large subscriber
// base from loading every matching user into memory in one query. Read at
// call-time so it can be tuned (or shrunk in tests) via env.
const cronScanBatch = () => parseInt(process.env.CRON_SCAN_BATCH, 10) || 500;

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

    // Save notification to database (priority: high for billing-critical)
    await Notification.create({
      userId: user._id,
      type: 'warning',
      priority: 'high',
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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const batchSize = cronScanBatch();
    const filter = {
      'subscription.status': 'active',
      'subscription.endDate': { $exists: true },
    };

    // _id-cursor pagination so a large active-subscriber base can't load every
    // matching user into memory at once (mirrors weeklyDigestService). Within
    // each batch the per-user Notification.findOne N+1 is collapsed into a single
    // bulk lookup keyed by userId:daysUntilExpiry.
    let after = null;
    // Bounded guard (defensive cap, not a real limit) against a cursor bug.
    for (let guard = 0; guard < 100000; guard++) {
      const batchFilter = after ? { ...filter, _id: { $gt: after } } : filter;
      const batch = await User.find(batchFilter)
        .sort({ _id: 1 })
        .limit(batchSize)
        .populate('membershipPackage');
      if (!batch.length) break;

      // Users due for a warning this run.
      const due = [];
      for (const user of batch) {
        const daysUntilExpiry = getDaysUntilExpiry(user);
        if (daysBefore.includes(daysUntilExpiry)) due.push({ user, daysUntilExpiry });
      }

      if (due.length) {
        // One query for all already-sent warnings in this batch (was 1/user).
        const sent = await Notification.find({
          userId: { $in: due.map((d) => d.user._id) },
          'data.daysUntilExpiry': { $in: daysBefore },
          createdAt: { $gte: startOfToday },
        }).select('userId data.daysUntilExpiry').lean();
        const sentKeys = new Set(sent.map((n) => `${n.userId}:${n.data?.daysUntilExpiry}`));

        for (const { user, daysUntilExpiry } of due) {
          if (sentKeys.has(`${user._id}:${daysUntilExpiry}`)) continue;
          const message = `Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}. Renew now to continue enjoying all features.`;
          await notificationService.notifyUser(user._id, {
            type: 'warning',
            title: 'Subscription Expiring Soon',
            message,
            data: { daysUntilExpiry, subscriptionEndDate: user.subscription.endDate },
          });
          await Notification.create({
            userId: user._id,
            type: 'warning',
            priority: 'high',
            title: 'Subscription Expiring Soon',
            message,
            data: { daysUntilExpiry, subscriptionEndDate: user.subscription.endDate },
          });
          logger.info('Expiration warning sent', { userId: user._id, daysUntilExpiry });
        }
      }

      after = batch[batch.length - 1]._id;
      if (batch.length < batchSize) break;
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
    const batchSize = cronScanBatch();
    const filter = {
      'subscription.status': 'active',
      'subscription.endDate': { $lt: now },
    };

    // _id-cursor pagination. handleSubscriptionExpiration flips status→'expired'
    // (and saves), so a processed user drops out of the `active` filter and the
    // next `_id > after` batch never re-fetches them — no double-processing.
    let processed = 0;
    let after = null;
    // Bounded guard (defensive cap, not a real limit) against a cursor bug.
    for (let guard = 0; guard < 100000; guard++) {
      const batchFilter = after ? { ...filter, _id: { $gt: after } } : filter;
      const batch = await User.find(batchFilter).sort({ _id: 1 }).limit(batchSize);
      if (!batch.length) break;
      const lastId = batch[batch.length - 1]._id;
      for (const user of batch) {
        await handleSubscriptionExpiration(user);
      }
      processed += batch.length;
      after = lastId;
      if (batch.length < batchSize) break;
    }

    logger.info('Expired subscriptions processed', { count: processed });
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







