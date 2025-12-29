// Role-based access control (RBAC)

const logger = require('../utils/logger');

/**
 * Check if user has required role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      logger.warn('Unauthorized role access attempt', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Check if user has required permission
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check user permissions
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Unauthorized permission access attempt', {
        userId: req.user._id,
        userPermissions,
        requiredPermissions: permissions,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Check if user owns resource or is admin
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource from request (could be from params, body, or query)
    const resourceUserId = req.body[resourceUserIdField] || 
                          req.params[resourceUserIdField] ||
                          req.query[resourceUserIdField];

    if (resourceUserId && resourceUserId.toString() !== req.user._id.toString()) {
      logger.warn('Unauthorized resource access attempt', {
        userId: req.user._id,
        resourceUserId,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

/**
 * Check membership package limits
 */
const checkMembershipLimits = (limitType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      const MembershipPackage = require('../models/MembershipPackage');
      const User = require('../models/User');
      
      // Get user with populated membership package
      const user = await User.findById(req.user._id).populate('membershipPackage');
      
      if (!user.membershipPackage) {
        return res.status(403).json({
          success: false,
          error: 'No active membership package'
        });
      }

      const membershipPackage = user.membershipPackage;
      const limits = membershipPackage.features[limitType];

      // Check if limit is -1 (unlimited)
      if (limits && limits.maxPerMonth === -1) {
        return next();
      }

      // Check usage (this would need to be implemented based on your usage tracking)
      // For now, we'll just check if the feature is available
      if (limits && limits.maxPerMonth === 0) {
        return res.status(403).json({
          success: false,
          error: `Feature not available in your membership package. Upgrade to access ${limitType}.`
        });
      }

      next();
    } catch (error) {
      logger.error('Membership limit check error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Error checking membership limits'
      });
    }
  };
};

module.exports = {
  requireRole,
  requirePermission,
  requireOwnership,
  checkMembershipLimits
};







