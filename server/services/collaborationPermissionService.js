// Collaboration Permission Service

const CollaborationPermission = require('../models/CollaborationPermission');
const Content = require('../models/Content');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

/**
 * Invite user to collaborate
 */
async function inviteCollaborator(contentId, ownerId, inviteeEmail, role, permissions) {
  try {
    // Find invitee user
    const invitee = await User.findOne({ email: inviteeEmail });
    if (!invitee) {
      throw new Error('User not found');
    }

    // Check if already has permission
    const existing = await CollaborationPermission.findOne({
      contentId,
      userId: invitee._id,
    });

    if (existing) {
      // Update existing permission
      existing.role = role;
      existing.permissions = permissions;
      existing.status = 'pending';
      existing.invitedBy = ownerId;
      existing.invitedAt = new Date();
      await existing.save();
    } else {
      // Create new permission
      const permission = new CollaborationPermission({
        contentId,
        userId: invitee._id,
        role,
        permissions,
        invitedBy: ownerId,
        status: 'pending',
      });
      await permission.save();
    }

    // Send invitation email
    const content = await Content.findById(contentId).select('title').lean();
    await sendEmail(
      inviteeEmail,
      'Collaboration Invitation',
      'collaboration-invite',
      {
        contentTitle: content.title,
        role,
        inviterName: (await User.findById(ownerId).select('name').lean()).name,
      }
    );

    logger.info('Collaborator invited', {
      contentId,
      ownerId,
      inviteeId: invitee._id,
      role,
    });

    return { success: true };
  } catch (error) {
    logger.error('Invite collaborator error', {
      error: error.message,
      contentId,
      ownerId,
    });
    throw error;
  }
}

/**
 * Accept collaboration invitation
 */
async function acceptInvitation(permissionId, userId) {
  try {
    const permission = await CollaborationPermission.findById(permissionId);

    if (!permission) {
      throw new Error('Permission not found');
    }

    if (permission.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    permission.status = 'accepted';
    permission.acceptedAt = new Date();
    await permission.save();

    logger.info('Invitation accepted', { permissionId, userId });
    return permission;
  } catch (error) {
    logger.error('Accept invitation error', {
      error: error.message,
      permissionId,
      userId,
    });
    throw error;
  }
}

/**
 * Check user permissions
 */
async function checkPermission(contentId, userId, action) {
  try {
    // Check if user is owner
    const content = await Content.findById(contentId).select('userId').lean();
    if (content.userId.toString() === userId.toString()) {
      return { allowed: true, reason: 'owner' };
    }

    // Check collaboration permissions
    const permission = await CollaborationPermission.findOne({
      contentId,
      userId,
      status: 'accepted',
    }).lean();

    if (!permission) {
      return { allowed: false, reason: 'no_permission' };
    }

    // Check specific permission
    const actionMap = {
      edit: 'canEdit',
      comment: 'canComment',
      share: 'canShare',
      delete: 'canDelete',
    };

    const permissionKey = actionMap[action];
    if (!permissionKey) {
      return { allowed: false, reason: 'unknown_action' };
    }

    // Role-based permissions
    if (permission.role === 'owner' || permission.role === 'editor') {
      return { allowed: true, reason: permission.role };
    }

    if (permission.permissions[permissionKey]) {
      return { allowed: true, reason: 'explicit_permission' };
    }

    return { allowed: false, reason: 'insufficient_permissions' };
  } catch (error) {
    logger.error('Check permission error', {
      error: error.message,
      contentId,
      userId,
      action,
    });
    return { allowed: false, reason: 'error' };
  }
}

/**
 * Get content collaborators
 */
async function getCollaborators(contentId) {
  try {
    const permissions = await CollaborationPermission.find({
      contentId,
      status: 'accepted',
    })
      .populate('userId', 'name email')
      .populate('invitedBy', 'name email')
      .lean();

    return permissions.map(p => ({
      userId: p.userId._id,
      name: p.userId.name,
      email: p.userId.email,
      role: p.role,
      permissions: p.permissions,
      invitedBy: p.invitedBy.name,
      acceptedAt: p.acceptedAt,
    }));
  } catch (error) {
    logger.error('Get collaborators error', {
      error: error.message,
      contentId,
    });
    return [];
  }
}

/**
 * Remove collaborator
 */
async function removeCollaborator(contentId, ownerId, collaboratorId) {
  try {
    // Verify owner
    const content = await Content.findById(contentId).select('userId').lean();
    if (content.userId.toString() !== ownerId.toString()) {
      throw new Error('Only owner can remove collaborators');
    }

    await CollaborationPermission.deleteOne({
      contentId,
      userId: collaboratorId,
    });

    logger.info('Collaborator removed', {
      contentId,
      ownerId,
      collaboratorId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Remove collaborator error', {
      error: error.message,
      contentId,
      ownerId,
    });
    throw error;
  }
}

module.exports = {
  inviteCollaborator,
  acceptInvitation,
  checkPermission,
  getCollaborators,
  removeCollaborator,
};






