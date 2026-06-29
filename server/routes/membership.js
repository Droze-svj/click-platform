// Membership package routes

const express = require('express');
const mongoose = require('mongoose');
const MembershipPackage = require('../models/MembershipPackage');
const User = require('../models/User');
const auth = require('../middleware/auth');

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));
const { requireRole } = require('../middleware/roleBasedAccess');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  getPricingTiers,
  comparePackages,
  getRecommendedPackage,
  calculateYearlySavings,
  getCompetitorComparison
} = require('../services/pricingService');
const router = express.Router();

/**
 * @swagger
 * /api/membership/packages:
 *   get:
 *     summary: Get all membership packages
 *     tags: [Membership]
 */
router.get('/packages', asyncHandler(async (req, res) => {
  const { getPricingTiers } = require('../services/pricingService');
  const packages = await getPricingTiers();
  sendSuccess(res, 'Membership packages fetched', 200, packages);
}));

/**
 * @swagger
 * /api/membership/packages/{slug}:
 *   get:
 *     summary: Get specific membership package
 *     tags: [Membership]
 */
router.get('/packages/:slug', asyncHandler(async (req, res) => {
  const membershipPackage = await MembershipPackage.findOne({
    slug: req.params.slug,
    isActive: true
  });

  if (!membershipPackage) {
    return sendError(res, 'Package not found', 404);
  }

  sendSuccess(res, 'Package fetched', 200, membershipPackage);
}));

/**
 * @swagger
 * /api/membership/current:
 *   get:
 *     summary: Get user's current membership
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 */
router.get('/current', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;

  // Supabase users (UUID) don't have a Mongo doc to populate. Return a
  // Free-tier shape so the membership card renders zeroes instead of 404.
  if (!isMongoUserId(userId)) {
    return sendSuccess(res, 'Current membership fetched', 200, {
      package: null,
      subscription: req.user?.subscription || { status: 'active', tier: 'free' },
      usage: { videosProcessed: 0, contentGenerated: 0, scriptsGenerated: 0, musicFiles: 0 },
      limits: null,
    });
  }

  const user = await User.findById(userId)
    .populate('membershipPackage')
    .select('membershipPackage subscription usage');

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Calculate usage statistics
  const usage = {
    videosProcessed: user.usage?.videosProcessed || 0,
    contentGenerated: user.usage?.contentGenerated || 0,
    scriptsGenerated: user.usage?.scriptsGenerated || 0,
    musicFiles: user.usage?.musicFiles || 0
  };

  // Get package limits
  const membershipPackage = user.membershipPackage;
  const limits = membershipPackage ? {
    videosPerMonth: membershipPackage.features.videoProcessing.maxVideosPerMonth,
    contentPerMonth: membershipPackage.features.contentGeneration.maxGenerationsPerMonth,
    scriptsPerMonth: membershipPackage.features.scripts.maxScriptsPerMonth,
    musicFiles: membershipPackage.features.music.maxMusicFiles,
    storage: membershipPackage.features.storage.maxStorage
  } : null;

  sendSuccess(res, 'Current membership fetched', 200, {
    package: user.membershipPackage,
    subscription: user.subscription,
    usage,
    limits
  });
}));

/**
 * @swagger
 * /api/membership/upgrade:
 *   post:
 *     summary: Upgrade membership package
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 */
router.post('/upgrade', auth, asyncHandler(async (req, res) => {
  const { packageSlug } = req.body;

  if (!packageSlug) {
    return sendError(res, 'Package slug is required', 400);
  }

  const membershipPackage = await MembershipPackage.findOne({
    slug: packageSlug,
    isActive: true
  });

  if (!membershipPackage) {
    return sendError(res, 'Package not found', 404);
  }

  const userId = req.userId || req.user?._id || req.user?.id;

  // SECURITY: a paid plan must NEVER be granted without a verified Whop
  // payment. This route previously flipped the user's membershipPackage with
  // zero payment — a free upgrade to any tier. It now returns the Whop
  // checkout target; entitlements are only applied later by the SIGNED webhook
  // (POST /api/webhooks/whop) once Whop confirms the payment.
  //
  // Build the checkout URL from the package's Whop product id (or a configured
  // store URL fallback). We pass the userId as Whop `metadata.passthrough` so
  // the webhook can resolve the exact user on payment.
  const whopProductId =
    membershipPackage.whopProductId ||
    membershipPackage.whop?.productId ||
    null;

  const storeBase = process.env.WHOP_STORE_URL || process.env.WHOP_CHECKOUT_URL || null;
  let checkoutUrl = null;
  if (whopProductId) {
    checkoutUrl = `https://whop.com/checkout/${encodeURIComponent(whopProductId)}?metadata[passthrough]=${encodeURIComponent(String(userId))}`;
  } else if (storeBase) {
    checkoutUrl = storeBase;
  }

  logger.info('Membership upgrade requested → routing to Whop checkout (no free grant)', {
    userId: String(userId),
    packageSlug,
    hasCheckoutUrl: Boolean(checkoutUrl),
  });

  if (!checkoutUrl) {
    return sendError(
      res,
      'Upgrades are processed through secure checkout. This plan is not yet linked to a checkout product — please contact support.',
      400,
      { code: 'CHECKOUT_REQUIRED', packageSlug }
    );
  }

  return sendSuccess(res, 'Complete your upgrade at checkout', 200, {
    checkoutRequired: true,
    checkoutUrl,
    package: {
      slug: membershipPackage.slug,
      name: membershipPackage.name,
    },
  });
}));

/**
 * @swagger
 * /api/membership/admin/packages:
 *   post:
 *     summary: Create membership package (Admin only)
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/packages', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const packageData = req.body;

  // Validate required fields
  if (!packageData.name || !packageData.price) {
    return sendError(res, 'Name and price are required', 400);
  }

  const newPackage = new MembershipPackage(packageData);
  await newPackage.save();

  logger.info('Membership package created', {
    packageId: newPackage._id,
    name: newPackage.name,
    createdBy: req.user._id
  });

  sendSuccess(res, 'Package created successfully', 201, newPackage);
}));

/**
 * @swagger
 * /api/membership/admin/packages/{packageId}:
 *   put:
 *     summary: Update membership package (Admin only)
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/packages/:packageId', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const membershipPackage = await MembershipPackage.findById(req.params.packageId);

  if (!membershipPackage) {
    return sendError(res, 'Package not found', 404);
  }

  // Mass-assignment guard: block identity/system fields (and the immutable slug).
  require('../utils/safeUpdate').applySafeUpdates(membershipPackage, req.body, { block: ['slug'] });
  await membershipPackage.save();

  logger.info('Membership package updated', {
    packageId: membershipPackage._id,
    updatedBy: req.user._id
  });

  sendSuccess(res, 'Package updated successfully', 200, membershipPackage);
}));

/**
 * @swagger
 * /api/membership/admin/packages/{packageId}:
 *   delete:
 *     summary: Delete membership package (Admin only)
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/admin/packages/:packageId', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const membershipPackage = await MembershipPackage.findById(req.params.packageId);

  if (!membershipPackage) {
    return sendError(res, 'Package not found', 404);
  }

  // Don't delete, just deactivate
  membershipPackage.isActive = false;
  await membershipPackage.save();

  logger.info('Membership package deactivated', {
    packageId: membershipPackage._id,
    deactivatedBy: req.user._id
  });

  sendSuccess(res, 'Package deactivated successfully', 200);
}));

/**
 * GET /api/membership/pricing/compare
 * Compare multiple packages
 */
router.get('/pricing/compare', asyncHandler(async (req, res) => {
  const { packages } = req.query;
  
  if (!packages) {
    return sendError(res, 'Package IDs required', 400);
  }

  const packageIds = packages.split(',');
  const comparison = await comparePackages(packageIds);
  sendSuccess(res, 'Package comparison retrieved', 200, comparison);
}));

/**
 * GET /api/membership/pricing/recommend
 * Get recommended package based on usage
 */
router.get('/pricing/recommend', auth, asyncHandler(async (req, res) => {
  const {
    videosPerMonth,
    contentGenerationsPerMonth,
    brands,
    teamMembers,
    needsMultiClient,
    needsWhiteLabel,
    needsSSO
  } = req.query;

  const usageData = {
    videosPerMonth: parseInt(videosPerMonth, 10) || 0,
    contentGenerationsPerMonth: parseInt(contentGenerationsPerMonth, 10) || 0,
    brands: parseInt(brands, 10) || 1,
    teamMembers: parseInt(teamMembers, 10) || 1,
    needsMultiClient: needsMultiClient === 'true',
    needsWhiteLabel: needsWhiteLabel === 'true',
    needsSSO: needsSSO === 'true'
  };

  const recommendations = await getRecommendedPackage(req.user._id, usageData);
  sendSuccess(res, 'Package recommendations retrieved', 200, recommendations);
}));

/**
 * GET /api/membership/pricing/savings
 * Calculate yearly savings
 */
router.get('/pricing/savings', asyncHandler(async (req, res) => {
  const { monthly, yearly } = req.query;

  if (!monthly || !yearly) {
    return sendError(res, 'Monthly and yearly prices required', 400);
  }

  const savings = calculateYearlySavings(parseFloat(monthly), parseFloat(yearly));
  sendSuccess(res, 'Savings calculated', 200, savings);
}));

/**
 * GET /api/membership/pricing/competitors
 * Get competitor comparison
 */
router.get('/pricing/competitors', asyncHandler(async (req, res) => {
  const comparison = getCompetitorComparison();
  sendSuccess(res, 'Competitor comparison retrieved', 200, comparison);
}));

module.exports = router;







