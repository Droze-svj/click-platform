// Security audit routes

const express = require('express');
const auth = require('../middleware/auth');
// Temporarily disable security audit service
// const {
//   getUserSecurityEvents,
//   getSecurityStats,
// } = require('../services/securityAuditService');

// Mock functions for now
const getUserSecurityEvents = async () => ({ events: [], total: 0 });
const getSecurityStats = async () => ({ totalEvents: 0, recentEvents: [] });
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
  const {
    limit = 50,
    skip = 0,
    eventType,
    severity,
    startDate,
    endDate,
  } = req.query;

  try {
    const result = await getUserSecurityEvents(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      eventType,
      severity,
      startDate,
      endDate,
    });

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
  const period = parseInt(req.query.period) || 30;

  try {
    const stats = await getSecurityStats(userId, period);
    sendSuccess(res, 'Security stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get security stats error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






