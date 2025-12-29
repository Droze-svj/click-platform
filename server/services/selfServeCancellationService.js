// Self-Serve Cancellation Service
// Easy cancellation with pro-rated refunds

const CancellationRequest = require('../models/CancellationRequest');
const RefundPolicy = require('../models/RefundPolicy');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Request cancellation (self-serve)
 */
async function requestCancellation(userId, cancellationData) {
  try {
    const {
      reason,
      reasonDetails,
      requestRefund = false,
      effectiveDate = null // null = immediate
    } = cancellationData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get refund policy
    const policy = await getRefundPolicy(user.membershipPackage);

    // Calculate refund if requested
    let refund = null;
    if (requestRefund && policy) {
      refund = await calculateRefund(userId, policy);
    }

    // Create cancellation request
    const cancellation = new CancellationRequest({
      userId,
      subscriptionId: user.subscription?.whopSubscriptionId || null,
      cancellation: {
        requestedAt: new Date(),
        effectiveDate: effectiveDate || new Date(),
        reason,
        reasonDetails,
        method: 'self_serve'
      },
      refund: refund ? {
        requested: true,
        amount: refund.amount,
        currency: refund.currency,
        calculation: refund.calculation,
        status: refund.autoApprove ? 'approved' : 'pending'
      } : { requested: false },
      status: 'pending'
    });

    await cancellation.save();

    // Cancel subscription
    await cancelUserSubscription(userId, cancellation.cancellation.effectiveDate);

    // Process refund if auto-approved
    if (refund && refund.autoApprove) {
      await processRefund(cancellation._id, refund);
    }

    logger.info('Cancellation requested', { userId, cancellationId: cancellation._id });
    return cancellation;
  } catch (error) {
    logger.error('Error requesting cancellation', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get refund policy
 */
async function getRefundPolicy(membershipPackageId) {
  try {
    const policy = await RefundPolicy.findOne({
      $or: [
        { 'appliesTo.all': true },
        { 'appliesTo.tiers': membershipPackageId },
        { 'appliesTo.plans': membershipPackageId }
      ],
      isActive: true
    }).sort({ createdAt: -1 }).lean();

    return policy;
  } catch (error) {
    logger.error('Error getting refund policy', { error: error.message });
    return null;
  }
}

/**
 * Calculate refund
 */
async function calculateRefund(userId, policy) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.subscription) {
      return null;
    }

    const subscription = user.subscription;
    const now = new Date();
    const startDate = new Date(subscription.startDate);
    const endDate = new Date(subscription.endDate);

    // Calculate days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysUsed = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = totalDays - daysUsed;

    // Get subscription amount (would get from actual subscription)
    const originalAmount = 0; // Would get from subscription record

    let refundAmount = 0;
    let autoApprove = false;

    switch (policy.policyType) {
      case 'pro_rated':
        if (policy.rules.proRated.enabled) {
          const dailyRate = originalAmount / totalDays;
          refundAmount = dailyRate * daysRemaining;
          
          // Apply processing fee
          if (policy.rules.proRated.processingFee > 0) {
            const fee = refundAmount * (policy.rules.proRated.processingFee / 100);
            refundAmount -= fee;
          }
          
          autoApprove = daysRemaining >= (policy.rules.proRated.minimumDays || 0);
        }
        break;
      case 'full_refund':
        if (policy.rules.fullRefund.enabled) {
          const daysSinceStart = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
          if (daysSinceStart <= policy.rules.fullRefund.timeLimit) {
            refundAmount = originalAmount;
            autoApprove = true;
          }
        }
        break;
      case 'partial_refund':
        if (policy.rules.partialRefund.enabled) {
          refundAmount = originalAmount * (policy.rules.partialRefund.percentage / 100);
          autoApprove = true;
        }
        break;
    }

    return {
      amount: Math.max(0, refundAmount),
      currency: 'USD',
      calculation: {
        originalAmount,
        daysUsed,
        daysRemaining,
        proRatedAmount: refundAmount,
        processingFee: policy.rules.proRated?.processingFee || 0,
        finalAmount: refundAmount
      },
      autoApprove
    };
  } catch (error) {
    logger.error('Error calculating refund', { error: error.message, userId });
    return null;
  }
}

/**
 * Cancel user subscription
 */
async function cancelUserSubscription(userId, effectiveDate) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update subscription status
    user.subscription.status = 'cancelled';
    user.subscription.endDate = effectiveDate;
    await user.save();

    // Would also cancel with payment provider (Stripe, etc.)
    logger.info('Subscription cancelled', { userId, effectiveDate });
  } catch (error) {
    logger.error('Error cancelling subscription', { error: error.message, userId });
    throw error;
  }
}

/**
 * Process refund
 */
async function processRefund(cancellationId, refund) {
  try {
    const cancellation = await CancellationRequest.findById(cancellationId);
    if (!cancellation) {
      throw new Error('Cancellation not found');
    }

    // Update refund status
    cancellation.refund.status = 'processing';
    await cancellation.save();

    // Process refund with payment provider
    // Would integrate with Stripe, PayPal, etc.
    const transactionId = await processPaymentRefund(cancellation.userId, refund);

    // Update cancellation
    cancellation.refund.status = 'processed';
    cancellation.refund.processedAt = new Date();
    cancellation.refund.transactionId = transactionId;
    cancellation.status = 'completed';
    await cancellation.save();

    logger.info('Refund processed', { cancellationId, amount: refund.amount });
    return cancellation;
  } catch (error) {
    logger.error('Error processing refund', { error: error.message, cancellationId });
    throw error;
  }
}

/**
 * Process payment refund (placeholder)
 */
async function processPaymentRefund(userId, refund) {
  // Would integrate with payment provider
  // For now, return placeholder transaction ID
  return `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Get cancellation status
 */
async function getCancellationStatus(userId) {
  try {
    const cancellation = await CancellationRequest.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return cancellation;
  } catch (error) {
    logger.error('Error getting cancellation status', { error: error.message, userId });
    return null;
  }
}

module.exports = {
  requestCancellation,
  getCancellationStatus,
  processRefund
};


