// Admin Audit Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getAuditLogs,
  getAdminActivitySummary,
} = require('../../services/adminAuditService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/audit/logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/logs', asyncHandler(async (req, res) => {
  const {
    userId,
    eventType,
    startDate,
    endDate,
    limit = 100,
    skip = 0,
  } = req.query;

  try {
    const result = await getAuditLogs({
      userId,
      eventType,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    sendSuccess(res, 'Audit logs fetched', 200, result);
  } catch (error) {
    logger.error('Get audit logs error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/audit/summary:
 *   get:
 *     summary: Get admin activity summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const period = parseInt(req.query.period) || 30;

  try {
    const summary = await getAdminActivitySummary(period);
    sendSuccess(res, 'Activity summary fetched', 200, summary);
  } catch (error) {
    logger.error('Get activity summary error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






