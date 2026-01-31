// Team collaboration service

const Team = require('../models/Team');
const User = require('../models/User');
const Content = require('../models/Content');
const ContentShare = require('../models/ContentShare');
const logger = require('../utils/logger');

/**
 * Create team
 */
async function createTeam(ownerId, teamData) {
  try {
    const team = new Team({
      name: teamData.name,
      description: teamData.description || '',
      ownerId,
      members: [{
        userId: ownerId,
        role: 'owner',
        permissions: {
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canShare: true,
          canApprove: true
        }
      }],
      settings: teamData.settings || {}
    });

    await team.save();
    logger.info('Team created', { teamId: team._id, ownerId });
    return team;
  } catch (error) {
    logger.error('Error creating team', { error: error.message, ownerId });
    throw error;
  }
}

/**
 * Get user's teams
 */
async function getUserTeams(userId) {
  try {
    const teams = await Team.find({
      $or: [
        { ownerId: userId },
        { 'members.userId': userId }
      ]
    }).populate('ownerId', 'name email');

    return teams;
  } catch (error) {
    logger.error('Error getting user teams', { error: error.message, userId });
    return [];
  }
}

/**
 * Get team by ID
 */
async function getTeamById(teamId, userId) {
  try {
    const team = await Team.findOne({
      _id: teamId,
      $or: [
        { ownerId: userId },
        { 'members.userId': userId }
      ]
    }).populate('ownerId', 'name email')
      .populate('members.userId', 'name email');

    if (!team) {
      throw new Error('Team not found or access denied');
    }

    return team;
  } catch (error) {
    logger.error('Error getting team by ID', { error: error.message, teamId, userId });
    throw error;
  }
}

/**
 * Invite member by email
 */
async function inviteByEmail(teamId, inviterId, { email, role }) {
  const normalized = (email || '').toLowerCase().trim();
  if (!normalized) {
    throw new Error('Email is required');
  }
  const invitedUser = await User.findOne({ email: normalized }).select('_id');
  if (!invitedUser) {
    throw new Error('No user found with that email. They must sign up first.');
  }
  return inviteMember(teamId, inviterId, { userId: invitedUser._id, role });
}

/**
 * Invite member to team
 */
async function inviteMember(teamId, inviterId, inviteData) {
  try {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if inviter has permission
    const inviter = team.members.find(m => m.userId.toString() === inviterId.toString());
    if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Check if user is already a member
    const existingMember = team.members.find(
      m => m.userId.toString() === inviteData.userId.toString()
    );
    if (existingMember) {
      throw new Error('User is already a team member');
    }

    const role = inviteData.role || team.settings.defaultRole;
    const permissions = getPermissionsForRole(role);

    team.members.push({
      userId: inviteData.userId,
      role,
      invitedBy: inviterId,
      permissions
    });

    await team.save();
    logger.info('Member invited to team', { teamId, userId: inviteData.userId });
    return team;
  } catch (error) {
    logger.error('Error inviting member', { error: error.message, teamId });
    throw error;
  }
}

/**
 * Update member role
 */
async function updateMemberRole(teamId, updaterId, memberId, newRole) {
  try {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if updater has permission
    const updater = team.members.find(m => m.userId.toString() === updaterId.toString());
    if (!updater || (updater.role !== 'owner' && updater.role !== 'admin')) {
      throw new Error('Insufficient permissions');
    }

    const member = team.members.find(m => m.userId.toString() === memberId.toString());
    if (!member) {
      throw new Error('Member not found');
    }

    member.role = newRole;
    member.permissions = getPermissionsForRole(newRole);

    await team.save();
    return team;
  } catch (error) {
    logger.error('Error updating member role', { error: error.message, teamId });
    throw error;
  }
}

/**
 * Remove member from team
 */
async function removeMember(teamId, removerId, memberId) {
  try {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if remover has permission
    const remover = team.members.find(m => m.userId.toString() === removerId.toString());
    if (!remover || (remover.role !== 'owner' && remover.role !== 'admin')) {
      throw new Error('Insufficient permissions');
    }

    // Can't remove owner
    const member = team.members.find(m => m.userId.toString() === memberId.toString());
    if (member && member.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    team.members = team.members.filter(m => m.userId.toString() !== memberId.toString());
    await team.save();

    return team;
  } catch (error) {
    logger.error('Error removing member', { error: error.message, teamId });
    throw error;
  }
}

/**
 * Share content with team or user
 */
async function shareContent(contentId, sharerId, shareData) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== sharerId.toString()) {
      throw new Error('Content not found or unauthorized');
    }

    const share = new ContentShare({
      contentId,
      sharedBy: sharerId,
      sharedWith: {
        type: shareData.type,
        userId: shareData.type === 'user' ? shareData.userId : null,
        teamId: shareData.type === 'team' ? shareData.teamId : null
      },
      permission: shareData.permission || 'view',
      expiresAt: shareData.expiresAt || null
    });

    await share.save();
    logger.info('Content shared', { contentId, shareId: share._id });
    return share;
  } catch (error) {
    logger.error('Error sharing content', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get permissions for role
 */
function getPermissionsForRole(role) {
  const permissions = {
    owner: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canApprove: true
    },
    admin: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canApprove: true
    },
    editor: {
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canShare: false,
      canApprove: false
    },
    viewer: {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canApprove: false
    }
  };

  return permissions[role] || permissions.viewer;
}

/**
 * Check if user has permission
 */
async function checkPermission(userId, teamId, permission) {
  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return false;
    }

    const member = team.members.find(m => m.userId.toString() === userId.toString());
    if (!member) {
      return false;
    }

    return member.permissions[permission] || false;
  } catch (error) {
    logger.error('Error checking permission', { error: error.message, userId, teamId });
    return false;
  }
}

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  inviteMember,
  inviteByEmail,
  updateMemberRole,
  removeMember,
  shareContent,
  checkPermission,
  getPermissionsForRole
};

