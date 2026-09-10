// Billing Routes
// Handle subscription changes, add-ons, promo codes, and usage

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// Supabase users have UUID ids; Mongoose-only ops (User.findById, populate)
// throw CastError when given a UUID. Guard with this helper.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));
const { sendSuccess, sendError } = require('../utils/response');
const { clampInt } = require('../utils/pagination');
const {
  processSubscriptionChange,
  applyPromoCode
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

const router = express.Router();

/**
 * POST /api/billing/upgrade
 * Upgrade or change subscription
 */
router.post('/upgrade', auth, asyncHandler(async (req, res) => {
  const { packageId, planId, billingCycle, promoCode, addOns } = req.body;
  const targetId = packageId || planId;
  const targetCycle = billingCycle || 'monthly';

  if (!targetId) {
    return sendError(res, 'Package ID is required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const result = await processSubscriptionChange(
    userId,
    targetId,
    targetCycle,
    promoCode,
    addOns || []
  );

  sendSuccess(res, 'Subscription change processed', 200, result);
}));

/**
 * POST /api/billing/change/:changeId/complete  — RETIRED (410)
 *
 * SECURITY: this endpoint used to flip the user to the purchased tier using only
 * `paymentIntentId`/`invoiceId` strings taken verbatim from req.body, with NO
 * call to the payment provider to confirm the payment succeeded — letting any
 * authenticated user self-grant Pro for free (POST /upgrade → POST /complete with
 * fake ids). Paid entitlements are granted ONLY by the signed Whop webhook
 * (whopWebhookService.processEvent), the same rule membership.js enforces. Direct
 * completion is permanently disabled.
 */
router.post('/change/:changeId/complete', auth, asyncHandler(async (req, res) => {
  return sendError(
    res,
    'Direct subscription completion is disabled. Subscriptions are activated by the payment provider after checkout.',
    410
  );
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
  const userId = req.user._id || req.user.id;
  const isDevUser = require('../utils/devUser').isDevUser(userId);

  // Dev users may not have a real Mongo record; return a safe empty payload
  // so the dashboard's billing card renders zeroes instead of 500ing.
  if (isDevUser) {
    return sendSuccess(res, 'Usage retrieved', 200, {
      usage: { videosProcessed: 0, contentGenerated: 0, quotesCreated: 0, postsScheduled: 0, storageUsedMb: 0, aiCreditsUsed: 0 },
      limits: { videosProcessed: -1, contentGenerated: -1, quotesCreated: -1, postsScheduled: -1, storageUsedMb: -1, aiCreditsUsed: -1 },
      overage: {},
      percentages: {},
      package: { name: 'Dev', slug: 'dev', tier: 'pro', billingCycle: 'monthly', status: 'active' },
      isEmpty: true,
    });
  }

  try {
    const entitlements = require('../config/entitlements');
    // Supabase users (UUID) don't have a Mongo doc to populate. Skip the
    // lookup and surface a Free-tier package, matching the dev-user branch.
    const user = isMongoUserId(userId)
      ? await User.findById(userId).populate('membershipPackage')
      : null;

    const tier = entitlements.resolveTier(user || req.user || {});
    const tierLimits = entitlements.LIMITS[tier] || entitlements.LIMITS.free;

    const usage = await getCurrentUsage(userId);
    
    // Canonical limits mapped to user selected package
    const limits = {
      videosProcessed: tierLimits.exportsPerMonth === Infinity ? -1 : tierLimits.exportsPerMonth,
      contentGenerated: tierLimits.aiGenerationsPerMonth === Infinity ? -1 : tierLimits.aiGenerationsPerMonth,
      postsScheduled: tierLimits.socialAccounts === Infinity ? -1 : (tierLimits.socialAccounts * 30),
      quotesCreated: tierLimits.aiGenerationsPerMonth === Infinity ? -1 : tierLimits.aiGenerationsPerMonth,
      storageUsedMb: tier === 'agency' ? -1 : (tier === 'pro' ? 50000 : (tier === 'creator' ? 10000 : 1000)),
      aiCreditsUsed: tierLimits.aiBudgetUsd === Infinity ? -1 : tierLimits.aiBudgetUsd,
    };

    const currentUsage = {
      videosProcessed: usage.usage?.videosProcessed || 0,
      contentGenerated: usage.usage?.contentGenerated || 0,
      postsScheduled: usage.usage?.postsScheduled || 0,
      quotesCreated: usage.usage?.quotesCreated || 0,
      storageUsedMb: usage.usage?.storageUsed || usage.usage?.storageUsedMb || 0,
      aiCreditsUsed: usage.usage?.aiCreditsUsed || 0,
    };

    // Calculate percentages safely
    const usagePercentages = {};
    Object.keys(currentUsage).forEach(key => {
      const limit = limits[key];
      if (limit !== -1 && limit > 0) {
        usagePercentages[key] = Math.min(100, Math.round((currentUsage[key] / limit) * 100));
      } else {
        usagePercentages[key] = -1; // Unlimited
      }
    });

    const packageName = user?.membershipPackage?.name || (tier.charAt(0).toUpperCase() + tier.slice(1));
    const packageSlug = user?.membershipPackage?.slug || tier;

    sendSuccess(res, 'Usage retrieved', 200, {
      usage: currentUsage,
      limits,
      overage: usage.overage || {},
      percentages: usagePercentages,
      package: {
        name: packageName,
        slug: packageSlug,
        tier,
        billingCycle: user?.subscription?.billingCycle || 'monthly',
        status: user?.subscription?.status || (tier === 'free' ? 'inactive' : 'active'),
      }
    });
  } catch (error) {
    // Degrade gracefully so the billing page stays usable when Mongo is empty
    // or services are flaky. Log so engineers can see real failures.
    require('../utils/logger').error('billing/usage failed', { error: error?.message, userId });
    sendSuccess(res, 'Usage retrieved', 200, {
      usage: {}, limits: {}, overage: {}, percentages: {},
      package: { name: 'Free', slug: 'free', tier: 'free', billingCycle: 'monthly', status: 'inactive' },
      degraded: true,
    });
  }
}));

/**
 * GET /api/billing/usage/stats
 * Get usage statistics
 */
router.get('/usage/stats', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const months = parseInt(req.query.months, 10) || 3;
  const stats = await getUsageStats(userId, months);
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

  const userId = req.userId || req.user?._id || req.user?.id;
  const check = await canPerformAction(userId, type, parseInt(amount, 10) || 1);
  sendSuccess(res, 'Usage check completed', 200, check);
}));

/**
 * GET /api/billing/overage
 * Get overage charges
 */
router.get('/overage', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const charges = await calculateOverageCharges(userId);
  sendSuccess(res, 'Overage charges calculated', 200, charges);
}));

/**
 * GET /api/billing/add-ons
 * Get available add-ons
 */
router.get('/add-ons', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const user = isMongoUserId(userId)
    ? await User.findById(userId).populate('membershipPackage')
    : null;
  const packageId = user?.membershipPackage?._id;

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
 * Publicly advertised promo codes only.
 *
 * This is unauthenticated, and it used to return every ACTIVE code with uses
 * remaining. referralService mints one-use, per-user rewards
 * (REF-REWARD-<id> / REF-NEW-<id>, maxUses: 1, active for 30-90 days) — so each
 * of those appeared here the moment it was created, and the first stranger to
 * read the list could redeem someone else's reward. It now returns only codes
 * explicitly flagged isPublic, which defaults to false: a code has to be marked
 * as broadcast to be listed.
 */
router.get('/promo-codes', asyncHandler(async (req, res) => {
  const now = new Date();
  const promoCodes = await PromoCode.find({
    isPublic: true,
    isActive: true,
    validFrom: { $lte: now },
    $and: [
      {
        $or: [
          { validUntil: { $gte: now } },
          { validUntil: null }
        ]
      },
      {
        $or: [
          { maxUses: -1 },
          { $expr: { $lt: ['$usedCount', '$maxUses'] } }
        ]
      }
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
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const userId = req.userId || req.user?._id || req.user?.id;

  const changes = await SubscriptionChange.find({ userId })
    .populate('fromPackage', 'name slug')
    .populate('toPackage', 'name slug')
    .populate('addOns.addOnId', 'name')
    .sort({ createdAt: -1 })
    .limit(clampInt(limit, 20, 500))
    .skip(clampInt(skip, 0, 100000, 0))
    .lean();

  const total = await SubscriptionChange.countDocuments({ userId });

  sendSuccess(res, 'Billing history retrieved', 200, {
    changes,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10))
    }
  });
}));

/**
 * GET /api/billing/referral/code
 * Get or generate referral code
 */
router.get('/referral/code', auth, asyncHandler(async (req, res) => {
  const { generateReferralCode } = require('../services/referralService');
  const userId = req.userId || req.user?._id || req.user?.id;
  const result = await generateReferralCode(userId);
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
  const userId = req.userId || req.user?._id || req.user?.id;
  const result = await applyReferralCode(userId, code);

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
  const userId = req.userId || req.user?._id || req.user?.id;
  const stats = await getReferralStats(userId);
  sendSuccess(res, 'Referral stats retrieved', 200, stats);
}));

/**
 * POST /api/billing/cancel
 * Self-service cancellation endpoint
 * Cancels recurring renewal while honoring prepaid access until the period end.
 */
router.post('/cancel', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const user = isMongoUserId(userId) ? await User.findById(userId) : null;

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const currentPlan = user.subscription?.plan || 'free';
  if (currentPlan === 'free' && user.subscription?.status !== 'active') {
    return sendError(res, 'You are already on the free tier with no active recurring subscription.', 400);
  }

  // Ensure end date exists so user doesn't lose access early
  const now = new Date();
  let endDate = user.subscription?.endDate ? new Date(user.subscription.endDate) : null;
  if (!endDate || endDate < now) {
    endDate = new Date(now);
    if (user.subscription?.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
  }

  user.subscription = user.subscription || {};
  user.subscription.status = 'cancelled';
  user.subscription.endDate = endDate;
  user.subscription.cancelledAt = now;
  await user.save();

  logger.info('[billing] self-service cancellation processed', {
    userId: user._id?.toString(),
    plan: currentPlan,
    accessValidUntil: endDate,
  });

  sendSuccess(res, 'Subscription cancelled successfully. You will retain full access until the end of your prepaid period.', 200, {
    cancelled: true,
    plan: currentPlan,
    status: 'cancelled',
    accessUntil: endDate,
  });
}));

/**
 * POST /api/billing/refund-request
 * 14-day statutory money-back guarantee request
 */
router.post('/refund-request', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const { reason = 'Not satisfied with features', details = '' } = req.body || {};
  const user = isMongoUserId(userId) ? await User.findById(userId) : null;

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const currentPlan = user.subscription?.plan || 'free';
  if (currentPlan === 'free') {
    return sendError(res, 'No paid subscription found on this account to refund.', 400);
  }

  // Check start date or billing history for purchase date
  let purchaseDate = user.subscription?.startDate;
  if (!purchaseDate) {
    try {
      const BillingHistory = require('../models/BillingHistory');
      const latestInvoice = await BillingHistory.findOne({ userId: user._id, status: 'paid' }).sort({ 'invoice.date': -1 });
      if (latestInvoice?.invoice?.date) {
        purchaseDate = latestInvoice.invoice.date;
      }
    } catch (_) {
      // Fallback
    }
  }

  if (!purchaseDate) {
    purchaseDate = user.createdAt || new Date();
  }

  const daysSince = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
  const isEligible = daysSince <= 14;

  const ticketId = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  if (!isEligible) {
    return sendSuccess(res, 'Refund request submitted for manual review', 200, {
      eligible: false,
      ticketId,
      daysSincePurchase: daysSince,
      message: `Your initial purchase was ${daysSince} days ago, which exceeds our standard 14-day window. Our support team at billing@clickapp.io has been notified to review your request for extenuating circumstances.`,
    });
  }

  // Mark subscription for cancellation/refund review
  user.subscription = user.subscription || {};
  user.subscription.refundRequestedAt = new Date();
  user.subscription.refundTicketId = ticketId;
  await user.save();

  logger.info('[billing] 14-day refund request approved & logged', {
    userId: user._id?.toString(),
    ticketId,
    daysSincePurchase: daysSince,
    reason,
  });

  sendSuccess(res, '14-Day Money-Back Guarantee request submitted successfully', 200, {
    eligible: true,
    ticketId,
    daysSincePurchase: daysSince,
    message: 'Your 14-day full refund request has been verified and scheduled for processing via Whop. Please allow 2-3 business days for funds to appear on your original payment method.',
  });
}));

/**
 * GET /api/billing/invoices/:invoiceNumber
 * Get invoice details
 */
router.get('/invoices/:invoiceNumber', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user?._id || req.user?.id;
  const { getInvoice } = require('../services/billingHistoryService');
  const invoice = await getInvoice(invoiceNumber, userId);
  sendSuccess(res, 'Invoice retrieved', 200, invoice);
}));

/**
 * GET /api/billing/invoices/:invoiceNumber/download
 * Download invoice PDF
 */
router.get('/invoices/:invoiceNumber/download', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user?._id || req.user?.id;
  const { downloadInvoicePDF } = require('../services/billingHistoryService');
  const pdf = await downloadInvoicePDF(invoiceNumber, userId);

  if (pdf?.content) {
    res.setHeader('Content-Type', pdf.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    return res.send(pdf.content);
  }

  sendSuccess(res, 'Invoice PDF ready', 200, pdf);
}));

/**
 * POST /api/billing/invoices/:invoiceNumber/correct
 * Request invoice correction
 */
router.post('/invoices/:invoiceNumber/correct', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user?._id || req.user?.id;
  const { reason } = req.body;
  if (!reason) {
    return sendError(res, 'Reason is required', 400);
  }
  const { requestInvoiceCorrection } = require('../services/billingHistoryService');
  const result = await requestInvoiceCorrection(invoiceNumber, userId, { reason });
  sendSuccess(res, 'Invoice correction requested', 200, result);
}));

module.exports = router;

