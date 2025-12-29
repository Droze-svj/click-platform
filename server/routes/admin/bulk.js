// Admin Bulk Operations Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  bulkUpdateUsers,
  bulkDeleteUsers,
  bulkUpdateContent,
  bulkDeleteContent,
  bulkExportData,
} = require('../../services/bulkOperationsService');
const { logAdminAction } = require('../../services/adminAuditService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/bulk/users/update:
 *   post:
 *     summary: Bulk update users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users/update', asyncHandler(async (req, res) => {
  const { userIds, updates } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return sendError(res, 'User IDs array is required', 400);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return sendError(res, 'Updates are required', 400);
  }

  try {
    const result = await bulkUpdateUsers(userIds, updates);
    
    // Log admin action
    await logAdminAction(req.user._id, 'bulk.update.users', {
      userIds: userIds.length,
      updates: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Users updated', 200, result);
  } catch (error) {
    logger.error('Bulk update users error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/bulk/users/delete:
 *   post:
 *     summary: Bulk delete users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users/delete', asyncHandler(async (req, res) => {
  const { userIds, softDelete = true } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return sendError(res, 'User IDs array is required', 400);
  }

  try {
    const result = await bulkDeleteUsers(userIds, softDelete);
    
    // Log admin action
    await logAdminAction(req.user._id, 'bulk.delete.users', {
      userIds: userIds.length,
      softDelete,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Users deleted', 200, result);
  } catch (error) {
    logger.error('Bulk delete users error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/bulk/content/update:
 *   post:
 *     summary: Bulk update content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/content/update', asyncHandler(async (req, res) => {
  const { contentIds, updates } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return sendError(res, 'Updates are required', 400);
  }

  try {
    const result = await bulkUpdateContent(contentIds, updates);
    
    // Log admin action
    await logAdminAction(req.user._id, 'bulk.update.content', {
      contentIds: contentIds.length,
      updates: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Content updated', 200, result);
  } catch (error) {
    logger.error('Bulk update content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/bulk/content/delete:
 *   post:
 *     summary: Bulk delete content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/content/delete', asyncHandler(async (req, res) => {
  const { contentIds } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  try {
    const result = await bulkDeleteContent(contentIds);
    
    // Log admin action
    await logAdminAction(req.user._id, 'bulk.delete.content', {
      contentIds: contentIds.length,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Content deleted', 200, result);
  } catch (error) {
    logger.error('Bulk delete content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/admin/bulk/export:
 *   post:
 *     summary: Bulk export data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/export', asyncHandler(async (req, res) => {
  const { userIds, format = 'json' } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return sendError(res, 'User IDs array is required', 400);
  }

  try {
    const result = await bulkExportData(userIds, format);
    
    // Log admin action
    await logAdminAction(req.user._id, 'bulk.export.data', {
      userIds: userIds.length,
      format,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Export queued', 200, result);
  } catch (error) {
    logger.error('Bulk export error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






