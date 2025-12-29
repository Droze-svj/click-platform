// Cancellation Improvement Service
// Win-back offers, pause subscription, feedback analysis

const CancellationRequest = require('../models/CancellationRequest');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get win-back offer
 */
async function getWinBackOffer(userId) {
  try {
    const cancellation = await CancellationRequest.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!cancellation) {
      return null;
    }

    const user = await User.findById(userId).populate('membershipPackage').lean();
    const currentTier = user.membershipPackage;

    // Generate offer based on cancellation reason
    const offers = {
      too_expensive: {
        type: 'discount',
        discount: 25, // 25% off
        duration: 3, // 3 months
        message: 'We understand price is a concern. Here\'s 25% off for 3 months.'
      },
      not_using: {
        type: 'pause',
        message: 'Would you like to pause your subscription instead of cancelling?'
      },
      missing_features: {
        type: 'upgrade',
        message: 'We\'re adding new features. Would you like early access?'
      },
      found_alternative: {
        type: 'comparison',
        message: 'Let us show you what makes Click different.'
      },
      technical_issues: {
        type: 'support',
        message: 'We\'d love to help resolve any technical issues. Free priority support for 30 days.'
      },
      billing_issues: {
        type: 'billing_help',
        message: 'Let us help resolve your billing concerns. We\'ll review your account personally.'
      }
    };

    const offer = offers[cancellation.cancellation.reason] || {
      type: 'general',
      discount: 20,
      duration: 2,
      message: 'We\'d love to keep you. Here\'s 20% off for 2 months.'
    };

    return {
      offer,
      cancellationReason: cancellation.cancellation.reason,
      cancellationDate: cancellation.cancellation.requestedAt,
      canPause: true,
      canReactivate: cancellation.status === 'completed'
    };
  } catch (error) {
    logger.error('Error getting win-back offer', { error: error.message, userId });
    return null;
  }
}

/**
 * Pause subscription
 */
async function pauseSubscription(userId, pauseData) {
  try {
    const {
      duration = 30, // days
      reason,
      resumeDate = null
    } = pauseData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate resume date
    const resume = resumeDate || new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

    // Update subscription
    user.subscription.status = 'paused';
    user.subscription.pausedAt = new Date();
    user.subscription.resumeDate = resume;
    await user.save();

    // Cancel any pending cancellation
    await CancellationRequest.updateMany(
      { userId, status: 'pending' },
      { status: 'cancelled', 'cancellation.cancelledReason': 'Subscription paused instead' }
    );

    logger.info('Subscription paused', { userId, resumeDate: resume });
    return {
      paused: true,
      resumeDate: resume,
      message: `Subscription paused until ${resume.toLocaleDateString()}`
    };
  } catch (error) {
    logger.error('Error pausing subscription', { error: error.message, userId });
    throw error;
  }
}

/**
 * Resume subscription
 */
async function resumeSubscription(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.subscription.status !== 'paused') {
      throw new Error('Subscription is not paused');
    }

    // Resume subscription
    user.subscription.status = 'active';
    user.subscription.resumeDate = null;
    user.subscription.pausedAt = null;
    await user.save();

    logger.info('Subscription resumed', { userId });
    return {
      resumed: true,
      message: 'Subscription resumed successfully'
    };
  } catch (error) {
    logger.error('Error resuming subscription', { error: error.message, userId });
    throw error;
  }
}

/**
 * Apply win-back offer
 */
async function applyWinBackOffer(userId, offerType, offerData) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    switch (offerType) {
      case 'discount':
        // Apply discount to subscription
        user.subscription.discount = {
          percent: offerData.discount,
          duration: offerData.duration,
          appliedAt: new Date()
        };
        await user.save();
        return { applied: true, message: `Discount applied: ${offerData.discount}% off` };

      case 'pause':
        return await pauseSubscription(userId, { reason: 'Win-back offer' });

      case 'upgrade':
        // Offer upgrade with discount
        return { applied: true, message: 'Upgrade offer sent' };

      default:
        return { applied: false, message: 'Unknown offer type' };
    }
  } catch (error) {
    logger.error('Error applying win-back offer', { error: error.message, userId });
    throw error;
  }
}

/**
 * Analyze cancellation feedback
 */
async function analyzeCancellationFeedback() {
  try {
    const cancellations = await CancellationRequest.find({
      'cancellation.reasonDetails': { $exists: true, $ne: '' }
    }).lean();

    const feedback = {
      byReason: {},
      commonIssues: [],
      sentiment: 'neutral'
    };

    // Group by reason
    cancellations.forEach(c => {
      const reason = c.cancellation.reason;
      if (!feedback.byReason[reason]) {
        feedback.byReason[reason] = {
          count: 0,
          details: []
        };
      }
      feedback.byReason[reason].count++;
      if (c.cancellation.reasonDetails) {
        feedback.byReason[reason].details.push(c.cancellation.reasonDetails);
      }
    });

    // Extract common issues
    const allDetails = cancellations
      .map(c => c.cancellation.reasonDetails)
      .filter(d => d);

    // Simple keyword extraction (would use NLP in production)
    const keywords = ['expensive', 'missing', 'bug', 'slow', 'confusing', 'limited'];
    keywords.forEach(keyword => {
      const count = allDetails.filter(d => d.toLowerCase().includes(keyword)).length;
      if (count > 0) {
        feedback.commonIssues.push({ keyword, count });
      }
    });

    return feedback;
  } catch (error) {
    logger.error('Error analyzing cancellation feedback', { error: error.message });
    return null;
  }
}

module.exports = {
  getWinBackOffer,
  pauseSubscription,
  resumeSubscription,
  applyWinBackOffer,
  analyzeCancellationFeedback
};


