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

      // Admins can access everything; otherwise the user's role must be in the
      // required set. The previous logic was fail-OPEN: when `requiredRoles`
      // contained 'admin' (the only role required by callers), the condition
      // `!requiredRoles.includes('admin')` was false, so the 403 was skipped and
      // next() ran for EVERY authenticated user — a privilege-escalation hole on
      // the plugin / tenant / performance-metrics admin routes.
      const isAdmin = userRole === 'admin';
      if (!isAdmin && !requiredRoles.includes(userRole)) {
        return sendError(res, 'Insufficient permissions', 403);
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
