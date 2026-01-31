// Role-based authorization middleware

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Require specific role(s)
 * @param {Array|string} roles - Required role(s)
 */
function requireRole(roles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const userRole = req.user.role || req.user.subscription?.tier || 'free';
      const requiredRoles = Array.isArray(roles) ? roles : [roles];

      if (!requiredRoles.includes(userRole) && !requiredRoles.includes('admin')) {
        // Check if user is admin (admins can access everything)
        if (userRole !== 'admin') {
          return sendError(res, 'Insufficient permissions', 403);
        }
      }

      next();
    } catch (error) {
      logger.error('Role auth error', { error: error.message });
      return sendError(res, 'Authorization error', 500);
    }
  };
}

module.exports = {
  requireRole,
};
