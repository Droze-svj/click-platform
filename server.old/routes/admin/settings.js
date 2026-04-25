// Admin Settings Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getSystemSettings,
  updateSystemSettings,
  enableMaintenanceMode,
  disableMaintenanceMode,
  isFeatureEnabled,
  getUserLimits,
} = require('../../services/systemSettingsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const settings = await getSystemSettings();
    sendSuccess(res, 'System settings fetched', 200, settings);
  } catch (error) {
    logger.error('Get system settings error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/settings:
 *   put:
 *     summary: Update system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/', asyncHandler(async (req, res) => {
  const updates = req.body;

  try {
    const settings = await updateSystemSettings(updates);
    sendSuccess(res, 'System settings updated', 200, settings);
  } catch (error) {
    logger.error('Update system settings error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/settings/maintenance/enable:
 *   post:
 *     summary: Enable maintenance mode
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/maintenance/enable', asyncHandler(async (req, res) => {
  const { message, startTime, endTime } = req.body;

  try {
    await enableMaintenanceMode(message, startTime, endTime);
    sendSuccess(res, 'Maintenance mode enabled', 200);
  } catch (error) {
    logger.error('Enable maintenance mode error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/settings/maintenance/disable:
 *   post:
 *     summary: Disable maintenance mode
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/maintenance/disable', asyncHandler(async (req, res) => {
  try {
    await disableMaintenanceMode();
    sendSuccess(res, 'Maintenance mode disabled', 200);
  } catch (error) {
    logger.error('Disable maintenance mode error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/settings/limits:
 *   get:
 *     summary: Get user limits
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/limits', asyncHandler(async (req, res) => {
  try {
    const limits = await getUserLimits();
    sendSuccess(res, 'User limits fetched', 200, limits);
  } catch (error) {
    logger.error('Get user limits error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






