// Workspace Isolation Middleware
// Ensure strict workspace separation - nothing crosses over accidentally

const Workspace = require('../models/Workspace');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verify user has access to workspace
 */
async function verifyWorkspaceAccess(userId, workspaceId, requiredPermission = null) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return { allowed: false, reason: 'Workspace not found' };
    }

    // Check if user is owner
    if (workspace.ownerId.toString() === userId.toString()) {
      return { allowed: true, role: 'owner', workspace };
    }

    // Check if user is a member
    const member = workspace.members.find(
      m => m.userId.toString() === userId.toString() && m.status === 'active'
    );

    if (!member) {
      return { allowed: false, reason: 'User is not a member of this workspace' };
    }

    // Check specific permission if required
    if (requiredPermission) {
      const hasPermission = member.permissions[requiredPermission];
      if (!hasPermission) {
        return {
          allowed: false,
          reason: `User does not have ${requiredPermission} permission`,
          role: member.role
        };
      }
    }

    return { allowed: true, role: member.role, workspace, member };
  } catch (error) {
    logger.error('Error verifying workspace access', { error: error.message, userId, workspaceId });
    return { allowed: false, reason: 'Error checking access' };
  }
}

/**
 * Verify client workspace belongs to agency
 */
async function verifyClientWorkspaceAccess(agencyWorkspaceId, clientWorkspaceId) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      return { allowed: false, reason: 'Agency workspace not found' };
    }

    const client = await Workspace.findById(clientWorkspaceId);
    if (!client || client.type !== 'client') {
      return { allowed: false, reason: 'Client workspace not found' };
    }

    // Check if client workspace is linked to agency
    // Option 1: Client owner is agency owner
    if (client.ownerId.toString() === agency.ownerId.toString()) {
      return { allowed: true, agency, client };
    }

    // Option 2: Client has agencyWorkspaceId in metadata
    if (client.metadata?.agencyWorkspaceId?.toString() === agencyWorkspaceId.toString()) {
      return { allowed: true, agency, client };
    }

    // Option 3: Check if agency owner created client workspace
    const agencyOwner = await User.findById(agency.ownerId);
    if (client.ownerId.toString() === agencyOwner._id.toString()) {
      return { allowed: true, agency, client };
    }

    return { allowed: false, reason: 'Client workspace does not belong to this agency' };
  } catch (error) {
    logger.error('Error verifying client workspace access', {
      error: error.message,
      agencyWorkspaceId,
      clientWorkspaceId
    });
    return { allowed: false, reason: 'Error checking access' };
  }
}

/**
 * Middleware to require workspace access
 */
const requireWorkspaceAccess = (requiredPermission = null) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required'
      });
    }

    const access = await verifyWorkspaceAccess(req.user._id, workspaceId, requiredPermission);

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: access.reason || 'Access denied',
        workspaceId
      });
    }

    req.workspace = access.workspace;
    req.workspaceRole = access.role;
    req.workspaceMember = access.member;
    next();
  };
};

/**
 * Middleware to require agency access to client workspace
 */
const requireAgencyClientAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const agencyWorkspaceId = req.params.agencyWorkspaceId || req.body.agencyWorkspaceId || req.query.agencyWorkspaceId;
  const clientWorkspaceId = req.params.clientWorkspaceId || req.body.clientWorkspaceId || req.query.clientWorkspaceId;

  if (!agencyWorkspaceId || !clientWorkspaceId) {
    return res.status(400).json({
      success: false,
      error: 'Agency and client workspace IDs are required'
    });
  }

  // First verify user has access to agency workspace
  const agencyAccess = await verifyWorkspaceAccess(req.user._id, agencyWorkspaceId);
  if (!agencyAccess.allowed) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to agency workspace'
    });
  }

  // Then verify client belongs to agency
  const clientAccess = await verifyClientWorkspaceAccess(agencyWorkspaceId, clientWorkspaceId);
  if (!clientAccess.allowed) {
    return res.status(403).json({
      success: false,
      error: clientAccess.reason || 'Client workspace does not belong to this agency'
    });
  }

  req.agencyWorkspace = clientAccess.agency;
  req.clientWorkspace = clientAccess.client;
  next();
};

/**
 * Middleware to ensure workspace isolation for content operations
 */
const enforceWorkspaceIsolation = async (req, res, next) => {
  if (!req.user) {
    return next(); // Let auth middleware handle this
  }

  // Get workspace from request
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;

  if (workspaceId) {
    const access = await verifyWorkspaceAccess(req.user._id, workspaceId);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to workspace'
      });
    }

    // Ensure all operations are scoped to this workspace
    req.workspaceId = workspaceId;
    req.workspace = access.workspace;
  }

  next();
};

/**
 * Filter query to only include resources from user's accessible workspaces
 */
async function getAccessibleWorkspaces(userId) {
  try {
    // Get workspaces where user is owner
    const ownedWorkspaces = await Workspace.find({ ownerId: userId }).select('_id').lean();

    // Get workspaces where user is a member
    const memberWorkspaces = await Workspace.find({
      'members.userId': userId,
      'members.status': 'active'
    }).select('_id').lean();

    const workspaceIds = [
      ...ownedWorkspaces.map(w => w._id),
      ...memberWorkspaces.map(w => w._id)
    ];

    return workspaceIds;
  } catch (error) {
    logger.error('Error getting accessible workspaces', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  verifyWorkspaceAccess,
  verifyClientWorkspaceAccess,
  requireWorkspaceAccess,
  requireAgencyClientAccess,
  enforceWorkspaceIsolation,
  getAccessibleWorkspaces
};


