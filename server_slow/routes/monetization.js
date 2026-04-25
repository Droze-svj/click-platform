const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const monetizationService = require('../services/monetizationService');
const User = require('../models/User');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/monetization/products:
 *   get:
 *     summary: Get available products for monetization
 *     tags: [Monetization]
 *     security:
 *       - bearerAuth: []
 */
router.get('/products', auth, asyncHandler(async (req, res) => {
  const provider = req.query.provider || req.user.monetizationSettings?.preferredProvider || 'whop';
  const products = await monetizationService.fetchProducts(provider);
  sendSuccess(res, 'Products retrieved', 200, { products, provider });
}));

/**
 * @swagger
 * /api/monetization/detect-triggers:
 *   post:
 *     summary: Detect high-intent triggers in transcript
 *     tags: [Monetization]
 *     security:
 *       - bearerAuth: []
 */
router.post('/detect-triggers', auth, asyncHandler(async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }
  const triggers = await monetizationService.detectCheckoutTriggers(transcript);
  sendSuccess(res, 'Triggers detected', 200, { triggers });
}));

/**
 * @swagger
 * /api/monetization/generate-plan:
 *   post:
 *     summary: Generate and persist a full monetization plan for content
 *     tags: [Monetization]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate-plan', auth, asyncHandler(async (req, res) => {
  const { contentId, transcript, provider, customProducts } = req.body;
  
  if (!contentId || !transcript) {
    return sendError(res, 'contentId and transcript are required', 400);
  }

  const userId = req.user._id || req.user.id;
  const selectedProvider = provider || req.user.monetizationSettings?.preferredProvider || 'whop';
  
  const plan = await monetizationService.generateAndPersistPlan(userId, contentId, transcript, {
    provider: selectedProvider,
    customProducts
  });

  sendSuccess(res, 'Monetization plan generated and saved', 201, plan);
}));

/**
 * @swagger
 * /api/monetization/plan/content/{contentId}:
 *   get:
 *     summary: Get monetization plan by content ID
 *     tags: [Monetization]
 */
router.get('/plan/content/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user._id || req.user.id;
  
  const plan = await monetizationService.getPlanByContent(userId, contentId);
  if (!plan) {
    return sendError(res, 'No plan found for this content', 404);
  }
  
  sendSuccess(res, 'Monetization plan retrieved', 200, plan);
}));

/**
 * @swagger
 * /api/monetization/plan/{id}:
 *   patch:
 *     summary: Update monetization plan (edit triggers)
 *     tags: [Monetization]
 */
router.patch('/plan/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  
  const plan = await monetizationService.updateMonetizationPlan(userId, id, req.body);
  sendSuccess(res, 'Monetization plan updated', 200, plan);
}));

/**
 * @swagger
 * /api/monetization/plan/{id}/finalize:
 *   post:
 *     summary: Finalize a monetization plan
 *     tags: [Monetization]
 */
router.post('/plan/:id/finalize', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  
  const plan = await monetizationService.updateMonetizationPlan(userId, id, { status: 'finalized' });
  sendSuccess(res, 'Monetization plan finalized', 200, plan);
}));

/**
 * @swagger
 * /api/monetization/settings:
 *   put:
 *     summary: Update user monetization settings
 *     tags: [Monetization]
 *     security:
 *       - bearerAuth: []
 */
router.put('/settings', auth, asyncHandler(async (req, res) => {
  const { preferredProvider, autoMonetize } = req.body;
  
  const user = await User.findById(req.user._id || req.user.id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Ensure monetizationSettings object exists (fallback if model update isn't synced in memory)
  if (!user.monetizationSettings) {
    user.monetizationSettings = { preferredProvider: 'whop', autoMonetize: false };
  }

  if (preferredProvider) {
    if (!['whop', 'shopify'].includes(preferredProvider)) {
      return sendError(res, 'Invalid provider. Must be whop or shopify', 400);
    }
    user.monetizationSettings.preferredProvider = preferredProvider;
  }

  if (typeof autoMonetize === 'boolean') {
    user.monetizationSettings.autoMonetize = autoMonetize;
  }

  await user.save();
  
  sendSuccess(res, 'Monetization settings updated', 200, {
    monetizationSettings: user.monetizationSettings
  });
}));

module.exports = router;
