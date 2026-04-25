// Collaboration Permissions Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  inviteCollaborator,
  acceptInvitation,
  checkPermission,
  getCollaborators,
  removeCollaborator,
} = require('../../services/collaborationPermissionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/collaboration/permissions/:contentId/invite:
 *   post:
 *     summary: Invite collaborator
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/invite', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { email, role, permissions } = req.body;

  if (!email || !role) {
    return sendError(res, 'Email and role are required', 400);
  }

  try {
    await inviteCollaborator(contentId, req.user._id, email, role, permissions);
    sendSuccess(res, 'Invitation sent', 200);
  } catch (error) {
    logger.error('Invite collaborator error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/permissions/:permissionId/accept:
 *   post:
 *     summary: Accept collaboration invitation
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:permissionId/accept', auth, asyncHandler(async (req, res) => {
  const { permissionId } = req.params;

  try {
    const permission = await acceptInvitation(permissionId, req.user._id);
    sendSuccess(res, 'Invitation accepted', 200, permission);
  } catch (error) {
    logger.error('Accept invitation error', { error: error.message, permissionId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/permissions/:contentId/check:
 *   get:
 *     summary: Check user permission
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/check', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { action } = req.query;

  if (!action) {
    return sendError(res, 'Action is required', 400);
  }

  try {
    const result = await checkPermission(contentId, req.user._id, action);
    sendSuccess(res, 'Permission checked', 200, result);
  } catch (error) {
    logger.error('Check permission error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/permissions/:contentId/collaborators:
 *   get:
 *     summary: Get content collaborators
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/collaborators', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const collaborators = await getCollaborators(contentId);
    sendSuccess(res, 'Collaborators fetched', 200, collaborators);
  } catch (error) {
    logger.error('Get collaborators error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/permissions/:contentId/remove:
 *   delete:
 *     summary: Remove collaborator
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:contentId/remove', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { collaboratorId } = req.body;

  if (!collaboratorId) {
    return sendError(res, 'Collaborator ID is required', 400);
  }

  try {
    await removeCollaborator(contentId, req.user._id, collaboratorId);
    sendSuccess(res, 'Collaborator removed', 200);
  } catch (error) {
    logger.error('Remove collaborator error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






