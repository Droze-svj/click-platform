// Brand and Workspace Limits Middleware
// Enforce subscription limits for brands and client workspaces

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

/**
 * Check if user can create another brand/workspace
 */
async function checkBrandLimit(userId) {
  try {
    const user = await User.findById(userId).populate('membershipPackage');
    
    if (!user || !user.membershipPackage) {
      return { allowed: false, reason: 'No active membership package' };
    }

    const pkg = user.membershipPackage;
    const maxBrands = pkg.limits?.maxBrands || 1;

    // Unlimited brands
    if (maxBrands === -1) {
      return { allowed: true, remaining: -1 };
    }

    // Count existing workspaces/brands
    const workspaceCount = await Workspace.countDocuments({
      ownerId: userId,
      type: { $ne: 'client' } // Don't count client workspaces
    });

    if (workspaceCount >= maxBrands) {
      return {
        allowed: false,
        reason: `Maximum ${maxBrands} brand${maxBrands > 1 ? 's' : ''} allowed in ${pkg.name} plan`,
        current: workspaceCount,
        limit: maxBrands,
        upgradeRequired: true
      };
    }

    return {
      allowed: true,
      remaining: maxBrands - workspaceCount,
      current: workspaceCount,
      limit: maxBrands
    };
  } catch (error) {
    logger.error('Error checking brand limit', { error: error.message, userId });
    return { allowed: false, reason: 'Error checking limits' };
  }
}

/**
 * Check if user can create another client workspace (for agencies)
 */
async function checkClientWorkspaceLimit(userId) {
  try {
    const user = await User.findById(userId).populate('membershipPackage');
    
    if (!user || !user.membershipPackage) {
      return { allowed: false, reason: 'No active membership package' };
    }

    const pkg = user.membershipPackage;
    const maxClientWorkspaces = pkg.limits?.maxClientWorkspaces || 0;

    // Check if agency features are enabled
    if (!pkg.agencyFeatures?.multiClientWorkspaces) {
      return {
        allowed: false,
        reason: 'Multi-client workspaces not available in your plan. Upgrade to Agency plan.',
        upgradeRequired: true
      };
    }

    // Unlimited client workspaces
    if (maxClientWorkspaces === -1) {
      return { allowed: true, remaining: -1 };
    }

    // Count existing client workspaces
    const clientWorkspaceCount = await Workspace.countDocuments({
      agencyId: userId,
      type: 'client'
    });

    if (clientWorkspaceCount >= maxClientWorkspaces) {
      return {
        allowed: false,
        reason: `Maximum ${maxClientWorkspaces} client workspace${maxClientWorkspaces > 1 ? 's' : ''} allowed in ${pkg.name} plan`,
        current: clientWorkspaceCount,
        limit: maxClientWorkspaces,
        upgradeRequired: true
      };
    }

    return {
      allowed: true,
      remaining: maxClientWorkspaces - clientWorkspaceCount,
      current: clientWorkspaceCount,
      limit: maxClientWorkspaces
    };
  } catch (error) {
    logger.error('Error checking client workspace limit', { error: error.message, userId });
    return { allowed: false, reason: 'Error checking limits' };
  }
}

/**
 * Middleware to check brand limit before creating workspace
 */
const requireBrandLimit = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const check = await checkBrandLimit(req.user._id);

  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      error: check.reason,
      upgradeRequired: check.upgradeRequired,
      current: check.current,
      limit: check.limit
    });
  }

  req.brandLimit = check;
  next();
};

/**
 * Middleware to check client workspace limit
 */
const requireClientWorkspaceLimit = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const check = await checkClientWorkspaceLimit(req.user._id);

  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      error: check.reason,
      upgradeRequired: check.upgradeRequired,
      current: check.current,
      limit: check.limit
    });
  }

  req.clientWorkspaceLimit = check;
  next();
};

module.exports = {
  checkBrandLimit,
  checkClientWorkspaceLimit,
  requireBrandLimit,
  requireClientWorkspaceLimit
};


