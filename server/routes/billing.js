// Billing Routes
// Handle subscription changes, add-ons, promo codes, and usage

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  processSubscriptionChange,
  completeSubscriptionChange,
  applyPromoCode,
  calculateProratedAmount
} = require('../services/billingService');
const {
  getCurrentUsage,
  getUsageStats,
  canPerformAction,
  calculateOverageCharges
} = require('../services/usageTrackingService');
const AddOn = require('../models/AddOn');
const PromoCode = require('../models/PromoCode');
const SubscriptionChange = require('../models/SubscriptionChange');
const User = require('../models/User');
const MembershipPackage = require('../models/MembershipPackage');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/billing/upgrade
 * Upgrade or change subscription
 */
router.post('/upgrade', auth, asyncHandler(async (req, res) => {
  const { packageId, billingCycle, promoCode, addOns } = req.body;

  if (!packageId || !billingCycle) {
    return sendError(res, 'Package ID and billing cycle are required', 400);
  }

  const result = await processSubscriptionChange(
    req.user._id,
    packageId,
    billingCycle,
    promoCode,
    addOns || []
  );

  sendSuccess(res, 'Subscription change processed', 200, result);
}));

/**
 * POST /api/billing/change/complete
 * Complete subscription change after payment
 */
router.post('/change/:changeId/complete', auth, asyncHandler(async (req, res) => {
  const { changeId } = req.params;
  const { paymentIntentId, invoiceId } = req.body;

  const change = await SubscriptionChange.findOne({
    _id: changeId,
    userId: req.user._id
  });

  if (!change) {
    return sendError(res, 'Subscription change not found', 404);
  }

  const completed = await completeSubscriptionChange(changeId, paymentIntentId, invoiceId);
  sendSuccess(res, 'Subscription change completed', 200, completed);
}));

/**
 * POST /api/billing/promo-code/validate
 * Validate promo code
 */
router.post('/promo-code/validate', auth, asyncHandler(async (req, res) => {
  const { code, packageId, amount } = req.body;

  if (!code) {
    return sendError(res, 'Promo code is required', 400);
  }

  const result = await applyPromoCode(code, packageId, amount);
  
  if (!result.valid) {
    return sendError(res, result.error || 'Invalid promo code', 400);
  }

  sendSuccess(res, 'Promo code applied', 200, result);
}));

/**
 * GET /api/billing/usage
 * Get current usage and limits
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const usage = await getCurrentUsage(req.user._id);
  const user = await User.findById(req.user._id).populate('membershipPackage');

  // Calculate percentages
  const usagePercentages = {};
  Object.keys(usage.usage).forEach(key => {
    const limit = usage.limits[key];
    if (limit !== -1 && limit > 0) {
      usagePercentages[key] = Math.round((usage.usage[key] / limit) * 100);
    } else {
      usagePercentages[key] = -1; // Unlimited
    }
  });

  sendSuccess(res, 'Usage retrieved', 200, {
    usage: usage.usage,
    limits: usage.limits,
    overage: usage.overage,
    percentages: usagePercentages,
    package: {
      name: user.membershipPackage?.name,
      slug: user.membershipPackage?.slug
    }
  });
}));

/**
 * GET /api/billing/usage/stats
 * Get usage statistics
 */
router.get('/usage/stats', auth, asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 3;
  const stats = await getUsageStats(req.user._id, months);
  sendSuccess(res, 'Usage statistics retrieved', 200, stats);
}));

/**
 * GET /api/billing/usage/check
 * Check if action can be performed
 */
router.get('/usage/check', auth, asyncHandler(async (req, res) => {
  const { type, amount } = req.query;

  if (!type) {
    return sendError(res, 'Usage type is required', 400);
  }

  const check = await canPerformAction(req.user._id, type, parseInt(amount) || 1);
  sendSuccess(res, 'Usage check completed', 200, check);
}));

/**
 * GET /api/billing/overage
 * Get overage charges
 */
router.get('/overage', auth, asyncHandler(async (req, res) => {
  const charges = await calculateOverageCharges(req.user._id);
  sendSuccess(res, 'Overage charges calculated', 200, charges);
}));

/**
 * GET /api/billing/add-ons
 * Get available add-ons
 */
router.get('/add-ons', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('membershipPackage');
  const packageId = user.membershipPackage?._id;

  const query = { isActive: true };
  if (packageId) {
    query.$or = [
      { compatiblePackages: { $size: 0 } }, // Available for all packages
      { compatiblePackages: packageId } // Available for this package
    ];
  }

  const addOns = await AddOn.find(query).sort({ sortOrder: 1, category: 1 });
  sendSuccess(res, 'Add-ons retrieved', 200, { addOns });
}));

/**
 * GET /api/billing/promo-codes
 * Get active promo codes (public)
 */
router.get('/promo-codes', asyncHandler(async (req, res) => {
  const now = new Date();
  const promoCodes = await PromoCode.find({
    isActive: true,
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: null }
    ],
    $or: [
      { maxUses: -1 },
      { $expr: { $lt: ['$usedCount', '$maxUses'] } }
    ]
  }).select('code description discountType discountValue validUntil').lean();

  sendSuccess(res, 'Promo codes retrieved', 200, { promoCodes });
}));

/**
 * GET /api/billing/history
 * Get billing history
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const changes = await SubscriptionChange.find({ userId: req.user._id })
    .populate('fromPackage', 'name slug')
    .populate('toPackage', 'name slug')
    .populate('addOns.addOnId', 'name')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await SubscriptionChange.countDocuments({ userId: req.user._id });

  sendSuccess(res, 'Billing history retrieved', 200, {
    changes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/billing/referral/code
 * Get or generate referral code
 */
router.get('/referral/code', auth, asyncHandler(async (req, res) => {
  const { generateReferralCode } = require('../services/referralService');
  const result = await generateReferralCode(req.user._id);
  sendSuccess(res, 'Referral code retrieved', 200, result);
}));

/**
 * POST /api/billing/referral/apply
 * Apply referral code (for new users)
 */
router.post('/referral/apply', auth, asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return sendError(res, 'Referral code is required', 400);
  }

  const { applyReferralCode } = require('../services/referralService');
  const result = await applyReferralCode(req.user._id, code);

  if (!result.valid) {
    return sendError(res, result.error || 'Invalid referral code', 400);
  }

  sendSuccess(res, 'Referral code applied', 200, result);
}));

/**
 * GET /api/billing/referral/stats
 * Get referral statistics
 */
router.get('/referral/stats', auth, asyncHandler(async (req, res) => {
  const { getReferralStats } = require('../services/referralService');
  const stats = await getReferralStats(req.user._id);
  sendSuccess(res, 'Referral stats retrieved', 200, stats);
}));

module.exports = router;

