// Team collaboration routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  createTeam,
  getUserTeams,
  inviteMember,
  updateMemberRole,
  removeMember,
  shareContent,
  checkPermission
} = require('../services/teamService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get user's teams
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const teams = await getUserTeams(req.user._id);
  sendSuccess(res, 'Teams fetched', 200, teams);
}));

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, description, settings } = req.body;

  if (!name) {
    return sendError(res, 'Team name is required', 400);
  }

  const team = await createTeam(req.user._id, { name, description, settings });
  sendSuccess(res, 'Team created', 201, team);
}));

/**
 * @swagger
 * /api/teams/{teamId}/invite:
 *   post:
 *     summary: Invite member to team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:teamId/invite', auth, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { userId, role } = req.body;

  if (!userId) {
    return sendError(res, 'User ID is required', 400);
  }

  const team = await inviteMember(teamId, req.user._id, { userId, role });
  sendSuccess(res, 'Member invited', 200, team);
}));

/**
 * @swagger
 * /api/teams/{teamId}/members/{memberId}/role:
 *   put:
 *     summary: Update member role
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:teamId/members/:memberId/role', auth, asyncHandler(async (req, res) => {
  const { teamId, memberId } = req.params;
  const { role } = req.body;

  if (!role) {
    return sendError(res, 'Role is required', 400);
  }

  const team = await updateMemberRole(teamId, req.user._id, memberId, role);
  sendSuccess(res, 'Member role updated', 200, team);
}));

/**
 * @swagger
 * /api/teams/{teamId}/members/{memberId}:
 *   delete:
 *     summary: Remove member from team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:teamId/members/:memberId', auth, asyncHandler(async (req, res) => {
  const { teamId, memberId } = req.params;
  const team = await removeMember(teamId, req.user._id, memberId);
  sendSuccess(res, 'Member removed', 200, team);
}));

/**
 * @swagger
 * /api/teams/share:
 *   post:
 *     summary: Share content with team or user
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/share', auth, asyncHandler(async (req, res) => {
  const { contentId, type, userId, teamId, permission } = req.body;

  if (!contentId || !type) {
    return sendError(res, 'Content ID and type are required', 400);
  }

  if (type === 'user' && !userId) {
    return sendError(res, 'User ID is required for user sharing', 400);
  }

  if (type === 'team' && !teamId) {
    return sendError(res, 'Team ID is required for team sharing', 400);
  }

  const share = await shareContent(contentId, req.user._id, {
    type,
    userId,
    teamId,
    permission: permission || 'view'
  });

  sendSuccess(res, 'Content shared', 201, share);
}));

module.exports = router;

