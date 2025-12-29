// Onboarding Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  getOnboardingProgress,
  completeStep,
  skipOnboarding,
  goToStep,
  resetOnboarding,
} = require('../services/onboardingService');
const {
  trackStepCompletion,
  getOnboardingAnalytics,
  assignOnboardingVariant,
} = require('../services/onboardingAnalyticsService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/onboarding:
 *   get:
 *     summary: Get onboarding progress
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const progress = await getOnboardingProgress(req.user._id);
    sendSuccess(res, 'Onboarding progress fetched', 200, progress);
  } catch (error) {
    logger.error('Get onboarding progress error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/complete-step:
 *   post:
 *     summary: Complete an onboarding step
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.post('/complete-step', auth, asyncHandler(async (req, res) => {
  const { stepId, data, timeSpent } = req.body;

  if (!stepId) {
    return sendError(res, 'Step ID is required', 400);
  }

  try {
    const progress = await completeStep(req.user._id, stepId, data);
    
    // Track analytics
    await trackStepCompletion(
      req.user._id,
      stepId,
      timeSpent || 0,
      false
    );
    
    sendSuccess(res, 'Step completed', 200, progress);
  } catch (error) {
    logger.error('Complete step error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/skip:
 *   post:
 *     summary: Skip onboarding
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.post('/skip', auth, asyncHandler(async (req, res) => {
  try {
    const progress = await skipOnboarding(req.user._id);
    sendSuccess(res, 'Onboarding skipped', 200, progress);
  } catch (error) {
    logger.error('Skip onboarding error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/goto-step:
 *   post:
 *     summary: Go to specific step
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.post('/goto-step', auth, asyncHandler(async (req, res) => {
  const { stepIndex } = req.body;

  if (stepIndex === undefined || stepIndex < 0) {
    return sendError(res, 'Valid step index is required', 400);
  }

  try {
    const progress = await goToStep(req.user._id, stepIndex);
    sendSuccess(res, 'Step changed', 200, progress);
  } catch (error) {
    logger.error('Go to step error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/reset:
 *   post:
 *     summary: Reset onboarding (admin only)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reset', auth, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const targetUserId = userId || req.user._id;

  // Only allow resetting own onboarding or admin
  if (targetUserId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized', 403);
  }

  try {
    await resetOnboarding(targetUserId);
    sendSuccess(res, 'Onboarding reset', 200);
  } catch (error) {
    logger.error('Reset onboarding error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/analytics:
 *   get:
 *     summary: Get onboarding analytics (admin)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  // Check admin role
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const period = parseInt(req.query.period) || 30;

  try {
    const analytics = await getOnboardingAnalytics({ period });
    sendSuccess(res, 'Analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get analytics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/onboarding/variant:
 *   get:
 *     summary: Get onboarding variant (A/B testing)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 */
router.get('/variant', auth, asyncHandler(async (req, res) => {
  try {
    const variant = await assignOnboardingVariant(req.user._id);
    sendSuccess(res, 'Variant assigned', 200, { variant });
  } catch (error) {
    logger.error('Get variant error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

