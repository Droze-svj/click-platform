// Admin Dashboard Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getDashboardOverview,
  getUserManagement,
  getContentAnalytics,
  getSystemHealth,
  updateUserRole,
  updateUserStatus,
} = require('../../services/adminDashboardService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

// All routes require admin
router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/dashboard/overview:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/overview', asyncHandler(async (req, res) => {
  const period = parseInt(req.query.period) || 30;

  try {
    const overview = await getDashboardOverview(period);
    sendSuccess(res, 'Dashboard overview fetched', 200, overview);
  } catch (error) {
    logger.error('Get dashboard overview error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/dashboard/users:
 *   get:
 *     summary: Get user management data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users', asyncHandler(async (req, res) => {
  const {
    search,
    role,
    status,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1,
  } = req.query;

  try {
    const result = await getUserManagement({
      search,
      role,
      status,
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder: parseInt(sortOrder),
    });
    sendSuccess(res, 'User management data fetched', 200, result);
  } catch (error) {
    logger.error('Get user management error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/dashboard/content:
 *   get:
 *     summary: Get content analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/content', asyncHandler(async (req, res) => {
  const period = parseInt(req.query.period) || 30;

  try {
    const analytics = await getContentAnalytics(period);
    sendSuccess(res, 'Content analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get content analytics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/dashboard/health:
 *   get:
 *     summary: Get system health
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await getSystemHealth();
    sendSuccess(res, 'System health fetched', 200, health);
  } catch (error) {
    logger.error('Get system health error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/dashboard/users/:userId/role:
 *   put:
 *     summary: Update user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:userId/role', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return sendError(res, 'Role is required', 400);
  }

  try {
    const user = await updateUserRole(userId, role);
    sendSuccess(res, 'User role updated', 200, user);
  } catch (error) {
    logger.error('Update user role error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/dashboard/users/:userId/status:
 *   put:
 *     summary: Update user status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:userId/status', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!status) {
    return sendError(res, 'Status is required', 400);
  }

  try {
    const user = await updateUserStatus(userId, status);
    sendSuccess(res, 'User status updated', 200, user);
  } catch (error) {
    logger.error('Update user status error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






