// Feature Flags Management Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  isFeatureEnabled,
  enableFeatureForUser,
  disableFeatureForUser,
  setRollout,
  getAllFeatureFlags,
  getFeatureFlag,
} = require('../services/featureFlagsService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/feature-flags:
 *   get:
 *     summary: Get all feature flags (admin only)
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const flags = getAllFeatureFlags();
    sendSuccess(res, 'Feature flags fetched', 200, flags);
  } catch (error) {
    logger.error('Get feature flags error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/feature-flags/:featureName:
 *   get:
 *     summary: Get feature flag status
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:featureName', auth, asyncHandler(async (req, res) => {
  const { featureName } = req.params;
  const userId = req.user._id.toString();

  try {
    const enabled = await isFeatureEnabled(featureName, userId);
    const flag = getFeatureFlag(featureName);

    sendSuccess(res, 'Feature flag status fetched', 200, {
      name: featureName,
      enabled,
      config: flag,
    });
  } catch (error) {
    logger.error('Get feature flag error', { error: error.message, featureName });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/feature-flags/:featureName/enable:
 *   post:
 *     summary: Enable feature for user (admin only)
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:featureName/enable', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { featureName } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return sendError(res, 'User ID is required', 400);
  }

  try {
    await enableFeatureForUser(featureName, userId);
    sendSuccess(res, 'Feature enabled for user', 200);
  } catch (error) {
    logger.error('Enable feature error', { error: error.message, featureName, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/feature-flags/:featureName/disable:
 *   post:
 *     summary: Disable feature for user (admin only)
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:featureName/disable', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { featureName } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return sendError(res, 'User ID is required', 400);
  }

  try {
    await disableFeatureForUser(featureName, userId);
    sendSuccess(res, 'Feature disabled for user', 200);
  } catch (error) {
    logger.error('Disable feature error', { error: error.message, featureName, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/feature-flags/:featureName/rollout:
 *   post:
 *     summary: Set rollout percentage (admin only)
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:featureName/rollout', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { featureName } = req.params;
  const { percentage } = req.body;

  if (percentage === undefined || percentage < 0 || percentage > 100) {
    return sendError(res, 'Rollout percentage must be between 0 and 100', 400);
  }

  try {
    await setRollout(featureName, percentage);
    sendSuccess(res, 'Rollout percentage set', 200);
  } catch (error) {
    logger.error('Set rollout error', { error: error.message, featureName, percentage });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






