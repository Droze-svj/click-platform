// Billing Service
// Handle prorated billing, upgrades, downgrades, and add-ons

const User = require('../models/User');
const MembershipPackage = require('../models/MembershipPackage');
const AddOn = require('../models/AddOn');
const PromoCode = require('../models/PromoCode');
const SubscriptionChange = require('../models/SubscriptionChange');
const logger = require('../utils/logger');

/**
 * Calculate prorated amount for subscription change
 */
function calculateProratedAmount(currentPackage, newPackage, currentBillingCycle, newBillingCycle, daysRemaining, daysInPeriod) {
  try {
    const currentPrice = currentBillingCycle === 'monthly' 
      ? currentPackage.price.monthly 
      : currentPackage.price.yearly / 12;
    
    const newPrice = newBillingCycle === 'monthly'
      ? newPackage.price.monthly
      : newPackage.price.yearly / 12;

    // Calculate credit for unused portion of current subscription
    const dailyRate = currentPrice / daysInPeriod;
    const credit = dailyRate * daysRemaining;

    // Calculate charge for new subscription
    const newDailyRate = newPrice / daysInPeriod;
    const charge = newDailyRate * daysRemaining;

    // Net amount (charge - credit)
    const proratedAmount = charge - credit;

    return {
      proratedAmount: Math.round(proratedAmount * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      daysRemaining,
      daysInPeriod
    };
  } catch (error) {
    logger.error('Error calculating prorated amount', { error: error.message });
    throw error;
  }
}

/**
 * Apply promo code
 */
async function applyPromoCode(code, packageId, amount) {
  try {
    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promoCode) {
      return { valid: false, error: 'Invalid promo code' };
    }

    // Check validity dates
    const now = new Date();
    if (promoCode.validFrom > now || (promoCode.validUntil && promoCode.validUntil < now)) {
      return { valid: false, error: 'Promo code expired' };
    }

    // Check max uses
    if (promoCode.maxUses !== -1 && promoCode.usedCount >= promoCode.maxUses) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }

    // Check min purchase amount
    if (amount < promoCode.minPurchaseAmount) {
      return { valid: false, error: `Minimum purchase amount is $${promoCode.minPurchaseAmount}` };
    }

    // Check if applicable to package
    if (promoCode.applicablePackages.length > 0) {
      const packageObjectId = typeof packageId === 'string' ? packageId : packageId.toString();
      const applicable = promoCode.applicablePackages.some(
        pkgId => pkgId.toString() === packageObjectId
      );
      if (!applicable) {
        return { valid: false, error: 'Promo code not applicable to this package' };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discountType === 'percentage') {
      discountAmount = (amount * promoCode.discountValue) / 100;
      if (promoCode.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, promoCode.maxDiscountAmount);
      }
    } else if (promoCode.discountType === 'fixed') {
      discountAmount = Math.min(promoCode.discountValue, amount);
    } else if (promoCode.discountType === 'free_months') {
      // For yearly subscriptions, calculate free months value
      discountAmount = (amount / 12) * promoCode.discountValue;
    }

    const finalAmount = Math.max(0, amount - discountAmount);

    return {
      valid: true,
      promoCode: promoCode._id,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue
    };
  } catch (error) {
    logger.error('Error applying promo code', { error: error.message, code });
    return { valid: false, error: 'Error validating promo code' };
  }
}

/**
 * Process subscription upgrade/downgrade
 */
async function processSubscriptionChange(userId, newPackageId, newBillingCycle, promoCode = null, addOnIds = []) {
  try {
    const user = await User.findById(userId).populate('membershipPackage');
    if (!user) {
      throw new Error('User not found');
    }

    const currentPackage = user.membershipPackage;
    const newPackage = await MembershipPackage.findById(newPackageId);
    if (!newPackage) {
      throw new Error('Package not found');
    }

    // Calculate days remaining in current billing period
    const now = new Date();
    const subscriptionEndDate = user.subscription.endDate || now;
    const daysRemaining = Math.max(0, Math.ceil((subscriptionEndDate - now) / (1000 * 60 * 60 * 24)));
    const daysInPeriod = user.subscription.plan === 'monthly' ? 30 : 365;

    // Calculate prorated amount
    const proration = calculateProratedAmount(
      currentPackage,
      newPackage,
      user.subscription.plan,
      newBillingCycle,
      daysRemaining,
      daysInPeriod
    );

    // Get add-on prices
    let addOnTotal = 0;
    const addOns = [];
    if (addOnIds.length > 0) {
      for (const addOnId of addOnIds) {
        const addOn = await AddOn.findById(addOnId);
        if (addOn && addOn.isActive) {
          const addOnPrice = newBillingCycle === 'monthly' 
            ? addOn.price.monthly 
            : addOn.price.yearly;
          addOnTotal += addOnPrice || 0;
          addOns.push({
            addOnId: addOn._id,
            action: 'added',
            price: addOnPrice
          });
        }
      }
    }

    // Calculate base amount
    const baseAmount = newBillingCycle === 'monthly'
      ? newPackage.price.monthly
      : newPackage.price.yearly;

    let totalAmount = baseAmount + addOnTotal + proration.proratedAmount;

    // Apply promo code if provided
    let discountAmount = 0;
    let promoCodeResult = null;
    if (promoCode) {
      promoCodeResult = await applyPromoCode(promoCode, newPackageId, totalAmount);
      if (promoCodeResult.valid) {
        discountAmount = promoCodeResult.discountAmount;
        totalAmount = promoCodeResult.finalAmount;
      }
    }

    // Create subscription change record
    const subscriptionChange = new SubscriptionChange({
      userId,
      changeType: newPackage.price.monthly > currentPackage.price.monthly ? 'upgrade' : 'downgrade',
      fromPackage: currentPackage._id,
      toPackage: newPackage._id,
      fromBillingCycle: user.subscription.plan,
      toBillingCycle: newBillingCycle,
      proratedAmount: proration.proratedAmount,
      proratedCredit: proration.credit,
      effectiveDate: now,
      billingDate: subscriptionEndDate,
      addOns,
      promoCode: promoCodeResult?.promoCode,
      discountAmount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: 'pending'
    });

    await subscriptionChange.save();

    logger.info('Subscription change created', {
      userId,
      changeType: subscriptionChange.changeType,
      totalAmount: subscriptionChange.totalAmount
    });

    return {
      subscriptionChange,
      breakdown: {
        baseAmount,
        addOnTotal,
        proratedAmount: proration.proratedAmount,
        credit: proration.credit,
        discountAmount,
        totalAmount: subscriptionChange.totalAmount
      },
      proration
    };
  } catch (error) {
    logger.error('Error processing subscription change', { error: error.message, userId });
    throw error;
  }
}

/**
 * Complete subscription change (after payment)
 */
async function completeSubscriptionChange(changeId, paymentIntentId = null, invoiceId = null) {
  try {
    const change = await SubscriptionChange.findById(changeId);
    if (!change) {
      throw new Error('Subscription change not found');
    }

    if (change.status === 'completed') {
      return change;
    }

    const user = await User.findById(change.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user subscription
    user.membershipPackage = change.toPackage;
    user.subscription.plan = change.toBillingCycle;
    user.subscription.startDate = change.effectiveDate;
    
    // Calculate new end date
    const periodDays = change.toBillingCycle === 'monthly' ? 30 : 365;
    user.subscription.endDate = new Date(change.effectiveDate);
    user.subscription.endDate.setDate(user.subscription.endDate.getDate() + periodDays);
    
    user.subscription.status = 'active';
    await user.save();

    // Update subscription change
    change.status = 'completed';
    change.paymentIntentId = paymentIntentId;
    change.invoiceId = invoiceId;
    await change.save();

    // Increment promo code usage if used
    if (change.promoCode) {
      await PromoCode.findByIdAndUpdate(change.promoCode, {
        $inc: { usedCount: 1 }
      });
    }

    logger.info('Subscription change completed', { changeId, userId: user._id });
    return change;
  } catch (error) {
    logger.error('Error completing subscription change', { error: error.message, changeId });
    throw error;
  }
}

module.exports = {
  calculateProratedAmount,
  applyPromoCode,
  processSubscriptionChange,
  completeSubscriptionChange
};


