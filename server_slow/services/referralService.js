// Referral Service
// Handle referral program and rewards

const User = require('../models/User');
const PromoCode = require('../models/PromoCode');
const logger = require('../utils/logger');

/**
 * Generate referral code for user
 */
async function generateReferralCode(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a referral code
    if (user.referralCode) {
      return { code: user.referralCode, existing: true };
    }

    // Generate unique code
    const code = `REF-${user._id.toString().substring(0, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    user.referralCode = code;
    user.referralStats = {
      totalReferrals: 0,
      activeReferrals: 0,
      totalRewards: 0
    };
    await user.save();

    logger.info('Referral code generated', { userId, code });
    return { code, existing: false };
  } catch (error) {
    logger.error('Error generating referral code', { error: error.message, userId });
    throw error;
  }
}

/**
 * Apply referral code
 */
async function applyReferralCode(newUserId, referralCode) {
  try {
    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return { valid: false, error: 'Invalid referral code' };
    }

    // Can't refer yourself
    if (referrer._id.toString() === newUserId.toString()) {
      return { valid: false, error: 'Cannot use your own referral code' };
    }

    // Check if user already used a referral code
    const newUser = await User.findById(newUserId);
    if (newUser.referredBy) {
      return { valid: false, error: 'User already used a referral code' };
    }

    // Create promo code for referrer reward
    const referrerRewardCode = await PromoCode.create({
      code: `REF-REWARD-${referrer._id.toString().substring(0, 8)}`,
      description: 'Referral reward - 1 month free',
      discountType: 'free_months',
      discountValue: 1,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      isActive: true
    });

    // Create promo code for new user
    const newUserRewardCode = await PromoCode.create({
      code: `REF-NEW-${newUserId.toString().substring(0, 8)}`,
      description: 'Welcome reward - 20% off first month',
      discountType: 'percentage',
      discountValue: 20,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true
    });

    // Update new user
    newUser.referredBy = referrer._id;
    newUser.referralRewardCode = newUserRewardCode._id;
    await newUser.save();

    // Update referrer stats
    referrer.referralStats = referrer.referralStats || {
      totalReferrals: 0,
      activeReferrals: 0,
      totalRewards: 0
    };
    referrer.referralStats.totalReferrals += 1;
    referrer.referralRewardCode = referrerRewardCode._id;
    await referrer.save();

    logger.info('Referral code applied', {
      referrerId: referrer._id,
      newUserId,
      referralCode
    });

    return {
      valid: true,
      referrerReward: referrerRewardCode.code,
      newUserReward: newUserRewardCode.code
    };
  } catch (error) {
    logger.error('Error applying referral code', { error: error.message, referralCode });
    return { valid: false, error: 'Error processing referral' };
  }
}

/**
 * Get referral stats
 */
async function getReferralStats(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const referredUsers = await User.find({ referredBy: userId }).countDocuments();
    const activeReferrals = await User.find({
      referredBy: userId,
      'subscription.status': 'active'
    }).countDocuments();

    return {
      referralCode: user.referralCode,
      totalReferrals: referredUsers,
      activeReferrals,
      stats: user.referralStats || {
        totalReferrals: 0,
        activeReferrals: 0,
        totalRewards: 0
      },
      rewardCode: user.referralRewardCode
    };
  } catch (error) {
    logger.error('Error getting referral stats', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  generateReferralCode,
  applyReferralCode,
  getReferralStats
};


