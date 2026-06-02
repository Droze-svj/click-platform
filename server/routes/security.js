// Security audit routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  getUserSecurityEvents,
  getSecurityStatistics,
} = require('../services/securityAuditService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/security/events:
 *   get:
 *     summary: Get user security events
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 */
router.get('/events', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 50 } = req.query;

  try {
    const result = await getUserSecurityEvents(userId, parseInt(limit, 10) || 50);

    sendSuccess(res, 'Security events fetched', 200, result);
  } catch (error) {
    logger.error('Get security events error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/security/stats:
 *   get:
 *     summary: Get security statistics
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = parseInt(req.query.period, 10) || 30;
  const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

  try {
    const stats = await getSecurityStatistics({ userId, startDate, endDate: new Date() });
    sendSuccess(res, 'Security stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get security stats error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






